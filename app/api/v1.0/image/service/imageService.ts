//import {resolve} from 'url';
import ImageModel from '../../../../models/image/image.model';
import UserModel from '../../../../models/user/user.model';
import {IImageModel} from '../../../../models/image/image.model.interface';
import {IImageFetcher} from "../../../../models/image/image.model";
import {ICropArea} from '../../../../models/image/image.model.interface';
import {eImageStatus, eImageTask, eSkippedCropReason} from "../../../../models/image/image.model.interface";
import {Logger} from "../../../../utils/logger";
import {Deserializer, IParsedRequest} from '../../../../utils/deserializer';
import {LemmingsService, LemmingsUsersInfoRes} from "../../../../services/lemmingsService";
import {NextImage} from "../../../../models/image/nextImage";
import {IIncomingMessage} from "../../../../utils/queueApi";
import ConfigModel from "../../../../models/config/config.model";
import metrics from "../../../../utils/metrics";
import {ImaginaryService} from "../../../../services/imaginaryService";
import {ConfigService} from '../../../../services/configService'
import * as mongoose from 'mongoose';

const skipcropped = ConfigService.getConfig('skipcropped');
const MAX_NUMBER_OF_MULTI_PAGES = skipcropped.maxPages;

interface IQueryResult {
  total: number;
  images: ImageModel[]
}

export const ERR_LOCKED_BY_OTHER_USER = "ERR_LOCKED_BY_OTHER_USER";

export default class ImageService {
  static next(user: UserModel, entityId?: string, pickOneForCrop?:boolean): Promise<IImageModel> {
    if (user) {
      let fetcher: IImageFetcher = new NextImage(user.id, user.tags);

      if (pickOneForCrop) {
        return ImageModel.getNext(fetcher, entityId, pickOneForCrop);
      } else {
        return ImageModel.getNext(fetcher, entityId);
      }

    } else
      return Promise.reject(null);
  }

  static byId(imageId: string): Promise<IImageModel> {
    return ImageModel.findById(imageId);
  }

  static byImaginaryId(imaginaryId: string): Promise<IImageModel> {
    return ImageModel.findByImaginaryIdOriginal(imaginaryId);
  }

  static createCropArea(imageId: string, user: UserModel, cropArea: any): Promise<ICropArea> {
    return new Promise((resolve, reject) => {
      return ImageModel.findById(imageId)
        .then((image) => {
          if (image) {
            //if the image is in progress state (i.e. not edited by manager) and it isn't assigned to this user
            if (image.status === eImageStatus.inProgress && image.activeUser && image.activeUser != user.id) {
              let error = new Error("image is locked by other user");
              error.name = ERR_LOCKED_BY_OTHER_USER;
              return reject(error)
            } else if (image.status === eImageStatus.done) {
              let msg = `Adding crop area is not allowed for image.id="${image.id}" with 'done' status`;
              Logger.warn(msg);
              return reject(msg);
            }

            image.createCropArea(user.id, cropArea)
              .then(cArea => {
                resolve(cArea)
              })
          } else {
            reject(null);
          }
        })
    })
  }

  static deleteCropArea(imageId: string, cropAreaId: string): Promise<boolean> {
    return ImageModel.findById(imageId)
      .then((image) => {
          if (image != null) {
            if (image.status === eImageStatus.done) {
              let msg = `Deleting crop area is not allowed for image.id="${image.id}" with 'done' status`;
              Logger.warn(msg);
              return Promise.reject(msg);
            } else
              return image.deleteCropArea(cropAreaId);
          } else {
            return Promise.resolve(false);
          }
        }
      );
  }

  static completeAsSingleImage(image: ImageModel, user: UserModel): Promise<boolean> {
    if (!image.activeUser || image.activeUser != user.id) {
      const msg = `Failed update single image info due to user is not active on image.id=${image.id}.`;
      Logger.error(msg);
      return Promise.reject(msg)
    }

    const onSuccess = isImage => {
      if (!isImage) {
        const msg = `Failed receiving image info for image.id=${image.id} - is not image!`;
        Logger.error(msg);
        return Promise.reject(msg)
      }

      return image.saveAsSingleImage(user.id)
    };

    return ImaginaryService
      .isImageFile(image.imaginaryIdOriginal)
      .then(onSuccess)
  }

  static complete(imageId: string, user: UserModel, status: string,
                  {comment, clientUrl, /*singleImage = false*/}: { comment: string, clientUrl: string, singleImage?: boolean }, reqToSkip?:object): Promise<boolean> {

    return ImageModel.findById(imageId)
      .then((image: ImageModel) => {
        if (image === null) {
          return Promise.resolve(false);
        }

        if (image.status === eImageStatus.done) {
          let msg = `Done action for image.id="${image.id}" is not allowed. Image already in 'done' status`;
          Logger.warn(msg);
          return Promise.reject(msg);
        } else if (eImageStatus[status] === eImageStatus.done) {
          if (reqToSkip) {
            return image.skipCrop(user.id, comment, clientUrl, reqToSkip);
          } else{
            return image.queueComplete(user.id, comment, clientUrl);
          }
        }

        else if (eImageStatus[status] === eImageStatus.rejected)
          return image.reject(user.id, comment, clientUrl);
        else if (eImageStatus[status] === eImageStatus.potentiallyBadFile) // potentiallyBadFile Status handler
          return image.setPotentiallyBadFile(user.id, comment, clientUrl);
        else if (eImageStatus[status] === eImageStatus.badFile) // badFile Status handler
          return image.setBadFile(user.id, comment, clientUrl);
        else {
          const msg = "Changing status from '" + eImageStatus[image.status] + "' to '" + status + "' is not supported";
          Logger.warn(msg);
          return Promise.reject(msg);
        }
      })
  }

  static getImagesStatuses(statuses: eImageStatus[]): Promise<object> {
    return ImageModel.aggregate(statuses)
      .then(resArr => {
        return resArr.reduce((acc, item) => {
          acc[item['_id']] = item['total'];
          return acc
        }, {})
      })
  }

  static query(params: any, limit: number, offset: number): Promise<IQueryResult> {

    return new Promise((resolve, reject) => {
      return ImageModel.query(params, limit, offset)
        .then(result => {
          return resolve(result)
        })
        .catch((err) => {
          reject(err)
        });
    })

  };


  private static getImageModel(requestObj: IParsedRequest): IImageModel {
    return {
      entityId: requestObj.entityId,
      status: eImageStatus.inProgress, // will override later if otherwise
      tags: requestObj.tags,
      source: requestObj.source,
      imaginaryIdOriginal: requestObj.imageId,
      requestedSkipCrop: requestObj.requestedSkipCrop || false,
      skippedCrop: false, //  will update to true if requestedSkipCrop == true and it is pdf or image
      forced: requestObj.force,
      reCalc: requestObj.reCalc,
      requestMetadata: {
        workloadId: requestObj.metadata.workloadId,
        reportId: requestObj.metadata.reportId,
        transactionId: requestObj.metadata.transactionId,
        companyId: requestObj.metadata.companyId,
        version: requestObj.metadata.version
      },
      reportId: requestObj.reportId
    };
  }

  // Function to process images that have the requestSkipCrop flag on
  static proccessSkippedCrop(imageObj) {         /// original context has been moved to  validateSkipRequest method so that it will be used internally.
    return ImageService.validateSkipRequest(imageObj);
  }

  static validateSkipRequest(imageObj, internalCall?) {
    // function onSuccess(info) {
    //   const isMultiPage = ImaginaryService.isMultiPageType(info); // Based on whether it's a multi page mime type
    //   if (isMultiPage && // Is it a file type that might contain multiple pages? and...
    //       info.metaData && // ...Info from imaginary includes metaData? and...
    //       info.metaData.numberOfPages <= MAX_NUMBER_OF_MULTI_PAGES) // ...There are less than a pre-defined number of pages?
    //   {
    //     if (internalCall) {
    //         let reqToSkip: {[key: string]: any} = {};
    //         reqToSkip.isValid = true;
    //         reqToSkip.reason = eSkippedCropReason.multiPages;
    //         return Promise.resolve(reqToSkip);
    //     } else {
    //     // It's safe to skip
    //       Logger.info(`'skip crop' multipage for imaginaryId="${imageObj.imaginaryIdOriginal}"`); // Log the skip
    //       metrics.increment("skip_crop_with_multipage"); // Increase the counter
    //       return Deserializer.skipMultiPage(imageObj); // Returns an image object with updated status (skipped)
    //     }
    //   }

    //   const isImage = ImaginaryService.isImageType(info); // Based on mime type
    //   if (isImage && // Is it an image file? and...
    //       !isMultiPage) // ...Ugly workaround to the way file type is identified, because tiff is considered both image and multi-page
    //   {
    //     if (internalCall) {
    //         let reqToSkip: {[key: string]: any} = {};
    //         reqToSkip.isValid = true;
    //         reqToSkip.reason = eSkippedCropReason.image;
    //         return Promise.resolve(reqToSkip);
    //     } else {
    //       // It's safe to skip
    //       metrics.increment("skip_crop_ok"); // Increase the counter
    //       return Deserializer.skipCrop(imageObj); // Returns an image object with updated status (skipped)
    //     }
    //   }

    //   // Fallthrough - Image was not skipped
    //   // We'll log all the info about not skipping so that we'll be able to debug this if we have to
    //   Logger.info(`Ignoring 'skip crop' for imaginaryId="${imageObj.imaginaryIdOriginal}". mimeType: ${info.mimeType}; isMultiPage: ${isMultiPage}; pages: ${info.metaData ? info.metaData.numberOfPages : 'unknown'}`);
    //   metrics.increment("skip_crop_ignored_not_image_file"); // Increase the counter
    //   return imageObj; // Returns an unchanged image object
    // }

    // // Function that runs if we fail in retrieving info about the image from imaginary
    // function onError(err) {
    //   // Just log and count the failure
    //   Logger.warn(`Failed receiving image info, canceling 'skip crop' for imaginaryId="${imageObj.imaginaryIdOriginal}". Error: ${err}`);
    //   metrics.increment("skip_crop_ignored_imaginary_error");
    //   return imageObj;
    // }

    // return ImaginaryService
    //   .getInfo(imageObj.imaginaryIdOriginal)
    //   .then(onSuccess)
    //   .catch(onError)

    if (internalCall) {
      let reqToSkip: {[key: string]: any} = {};
      reqToSkip.isValid = true;
      reqToSkip.reason = eSkippedCropReason.image;
      return Promise.resolve(reqToSkip);
    }
  }

  static findLastIfExist(imaginaryId: string): Promise<IImageModel> {
    return new Promise((resolve: Function, /*reject: Function*/) => {
      let query = {status: eImageStatus.done, imaginaryIdOriginal: imaginaryId};
      let options = {skip: 0, limit: 1, sort: {updatedAt: "desc"}};
      ImageModel
        .find(query, options)
        .then((images) => (images || images.length > 0) ? resolve(images[0]) : resolve(null))
    });
  }


  static initModel(requestObj: IParsedRequest): Promise<IImageModel> {
    return new Promise((resolve: Function, /*reject: Function*/) => {
      let imageObj: IImageModel = ImageService.getImageModel(requestObj);

      if (imageObj.forced) {
        resolve(imageObj)
      } else if (imageObj.requestedSkipCrop) {
        ImageService.proccessSkippedCrop(imageObj)
          .then((image) => resolve(image))
      } else { // check if exist

        ImageService
          .findLastIfExist(imageObj.imaginaryIdOriginal)
          .then(image => {
            if (image) { // exist in db
              imageObj = Deserializer.getCropAreasFromLastExist(imageObj, image)
            }

            resolve(imageObj)
          })
      }
    })
  }

  static create(requestObj: IParsedRequest): Promise<IImageModel> {
    if (requestObj == null) {
      Logger.warn("Missing parsed request object");

      return Promise.resolve(null);
    }

    let createdImage: ImageModel;

    return ImageService
      .initModel(requestObj)
      .then(ImageModel.create)
      .then((image) => {
        createdImage = image;
        if (image.skippedCrop) {
          metrics.increment(`skipped_crop`, 1, [image.skippedCropReason]);
        }

        return ConfigModel.getConfig()
      })
      //.then((config) => config.considerExistingEntity(requestObj.entityId))
      .then(() => createdImage);
  }

  static createHandler(message: IIncomingMessage): Promise<void> {
    return new Promise((resolve: Function, reject: Function) => {
      let messageBodyObj = Deserializer.fromMessageBody(message.body);

      if (messageBodyObj != null) {
        ImageService.create(messageBodyObj)
          .then((image) => {
            Logger.debug(`Image document (id="${image.id}") was created for message: ${JSON.stringify(message)}`);
            return resolve();
          })
          .catch((err) => {
            metrics.increment("failed_handle_image_creation", 1);
            metrics.increment("failed_handle_image_creation_second_value");
            let logMsg = `Failed crating image document for message: ${JSON.stringify(message)}. Error: "${JSON.stringify(err)}"`;
            Logger.error(logMsg);
            return reject(new Error(logMsg));
          });
      } else {
        let msg = `Could not deserialize message.body="${message.body}" (message.id="${message.messageId}")`;
        Logger.warn(msg);
        reject(msg);
      }

    });
  }

  static reportByEntitiesStatuses(): Promise<IQueryResult> {
    return new Promise((resolve, reject) => {
      ImageModel.reportByEntitiesStatuses()
        .then((results) => {
          resolve(results)
        })
        .catch((err) => {
          reject(err)
        })
    });
  };

  static reportByEntitiesStatusInProgress(): Promise<IQueryResult> {

    return new Promise((resolve, reject) => {
      ImageModel.reportByEntitiesStatusInProgress()
        .then((results: IQueryResult) => {
          resolve(results)
        })
        .catch((err) => {
          reject(err)
        })
    })
  };

  static reportByEntities(fromDate: Date, toDate: Date): Promise<IQueryResult> {
    return new Promise((resolve, reject) => {
      ImageModel.reportByEntities(fromDate, toDate)
        .then((results) => {
          resolve(results)
        })
        .catch((err) => {
          reject(err)
        });
    })
  };

  static reportByUsers(requestingUserId: string, fromDate: Date, toDate: Date): Promise<any> {
    let resultCounters;
    let countersByVatboxUserId = {};

    Logger.debug(`Generating image report by users (fromDate="${fromDate}", toDate="${toDate}")`);

    // get report by user.id
    return (ImageModel.reportByUsers(fromDate, toDate))
      .then((results) => {
        Logger.debug(`Generating image report by users - got counters`);

        if (results == null)
          return Promise.resolve(null);
        else {
          let userIds = <string[]>Object.keys(results).map((id) => id);

          resultCounters = results;

          return UserModel.findByIds(userIds)
          // transform last report to be by user.vatboxUserId and request names from lemmings service
            .then((users: [UserModel]) => {
              Logger.debug(`Generating image report by users - got vatbox ids (fatlady)`);
              users.forEach((user) => countersByVatboxUserId[user.vatboxUserId.toString()] = resultCounters[user.id]);

              return LemmingsService.getUsers(requestingUserId, users.map((user) => user.vatboxUserId));
            })
            // add names to last report, and return
            .then((usersInfo: LemmingsUsersInfoRes) => {
              Logger.debug(`Generating image report by users - got user details from lemmings`);
              usersInfo.found.forEach((userInfo) => {
                if (countersByVatboxUserId[userInfo._id] != null)
                  countersByVatboxUserId[userInfo._id].name = `${userInfo.firstName} ${userInfo.lastName}`;
              });

              return Promise.resolve(countersByVatboxUserId);
            })
        }
      })
      .catch((err) => {
        return Promise.reject(err)
      });
  };

  private static getStatusErrorQuery(): object {
    const config = ConfigService.getConfig('tasks');
    return {
      status: eImageStatus.error,
      "nextTask.retries": {$gte: config.maxRetries}
    }
  }

  private static getRangeToQuery(from, to, field): any[] {
    const andQuery = [];
    if (from) andQuery.push({[field]: {$gte: from}});
    if (to) andQuery.push({[field]: {$lte: to}});
    return andQuery
  }

  static getImagesStatusErrorCount({from, to}): Promise<IImageModel> {

    const query = ImageService.getStatusErrorQuery();
    const range = ImageService.getRangeToQuery(from, to, 'updatedAt');
    if (range.length > 0) {
      Object.assign(query, {$and: range})
    }

    Logger.debug("Counting images with status error with the query: " + JSON.stringify(query));
    return ImageModel.find(query, null)
      .then(images => images.length);
  }

  static retryFailureImages({from, to, ids = []}): Promise<any> {
    const objectId = mongoose.Types.ObjectId;
    let query = ImageService.getStatusErrorQuery();
    const range = ImageService.getRangeToQuery(from, to, 'updatedAt');
    if (range.length > 0) {
      Object.assign(query, {$and: range})
    }

    if (ids.length > 0) {
      const objIds = ids.map(id => new objectId(id));
      Object.assign(query, {_id: {$in: objIds}})
    }

    return ImageModel.resetRetries(query)
  }
}

