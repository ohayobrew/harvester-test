import {Logger} from '../../utils/logger';
import {Deserializer} from '../../utils/deserializer';
import {Pagination} from '../../utils/pagination';

import metrics from "../../utils/metrics";
import {ConfigService} from '../../services/configService';
import {
  eCropAreaStatus,
  eImageStatus,
  eImageTask,
  eSkippedCropReason,
  ICloudinary,
  ICropArea,
  IError,
  IImageModel,
  IImageModelMongoose,
  INextTask,
  IRails,
  IRequestMetadata
} from "./image.model.interface";
import ConfigModel from "../config/config.model";
import {Helpers} from "../../helpers/helpers";
import * as mongoose from 'mongoose';
import * as _ from 'lodash';
import * as util from 'util';
import * as Collections from 'typescript-collections';
//get retryCount from config default = 3
const retryCount = (ConfigService.getConfig('retryCount')) ? ConfigService.getConfig('retryCount') : 3;

let _schema = new mongoose.Schema({
  cloudinary: {
    publicId: String,
    version: String,
    format: String,
  },
  clientUrl: String,
  tsSubmitted: Date,
  createdAt: {type: Date, default: Date.now, index: false},
  updatedAt: Date,
  activeUser: {type: mongoose.Schema.Types.ObjectId, ref: "User", index: false},
  doneAt: {type: Date, index: false},
  doneByUser: {type: mongoose.Schema.Types.ObjectId, ref: "User", index: false},
  rejectedAt: {type: Date, index: false},
  rejectedByUser: {type: mongoose.Schema.Types.ObjectId, ref: "User", index: false},
  tags: {type: [String], index: false},
  cropAreas: [{
    createdAt: {type: Date, index: false},
    updatedAt: Date,
    createdByUserId: {type: String, index: false},
    cloudinary: {
      publicId: String,
      version: String,
      format: String,
    },
    x: Number,
    y: Number,
    width: Number,
    height: Number,
    rotation: Number,
    status: {type: String},
    imaginaryId: String,
    invoiceId: String,
    invoiceCreatedAt: Date,
    queue: {
      enqueuedAt: Date,
      messageId: String,
      transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        get: (objectId) => objectId ? objectId.toString() : undefined,
        unique: true,
        sparse: true,
        background: true
      },
    },
    preProcess: {
      actions: [String],
    }
  }],
  comment: String,
  status: {type: String, index: false},
  rails: {
    bulkId: String,
    bulkCreatedAt: Date
  },
  entityId: {type: String, index: false},
  imaginaryId: String,
  source: String,
  lastError: {
    message: String,
    occurredAt: Date,
    task: {type: String, get: (str) => eImageTask[str], set: (status) => eImageTask[status]}
  },
  imaginaryIdOriginal: {type: String, index: false},
  nextTask: {
    task: {type: String, index: false},
    errorLog: [{
      message: String,
      occurredAt: Date,
      task: {type: String}
    }],
    retries: {type: Number, index: false},
    lastRetry: {type: Date, index: false}
  },
  completedTasks: [String],
  reportId: String,
  requestMetadata: {
    workloadId: {type: String, index: false},
    reportId: String,
    transactionId: {type: String, unique: true, sparse: true, background: true},
    companyId: String,
    version: String
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    get: (objectId) => objectId != null ? objectId.toString() : undefined,
    unique: true,
    sparse: true,
    background: true
  },
  skippedCrop: {type: Boolean, index: false},
  requestedSkipCrop: {type: Boolean, index: false},
  skippedCropReason: {type: eSkippedCropReason, index: false},
  forced: {type: Boolean, index: false},
  cropAreasOriginId: {type: String, index: false},
  singleImage: String,
  reCalc: {type: Boolean, index: false},
  detectedAt: Date,//Date field to be used by the badFile PotentiallyBadFileFilter
  detectedByUser: String, //Detected by wich User ID
  detectionCount: {type: Number, default: 0} // potentiallyBadFile counter

});

_schema.index({updatedAt: -1}, {sparse: true, background: true}); // need to be descending
_schema.index({status: 1, "nextTask.lastRetry": 1, "nextTask.retries": 1}, {background: true});
_schema.index({status: 1, entityId: 1, createdAt: 1, updatedAt: 1}, {background: true});
_schema.index({imaginaryIdOriginal: 1, status: 1}, {background: true});

let _model: mongoose.Model<IImageModelMongoose> = mongoose.model<IImageModelMongoose>("Image", _schema);

export interface IImageFetcher {
  fetch: (entityId?: string, pickOneForCrop?: boolean) => Promise<ImageModel>;
}

interface IQueryResult {
  total: number;
  images: ImageModel[]
}

interface IEntityId {
  entityId: string,

  [others: string]: any;
} // force entityId property, other are optional
class ImageModel implements IImageModel {
  private _document: IImageModelMongoose;
  private _thisModel: IImageModel;
  private _id: string;

  constructor(imageModel: IImageModel) {
    if (imageModel) {
      this._thisModel = imageModel;

      // allow using the lean() method of mongoose, and still have .id
      this.saveId(imageModel);
    }
  }

  static get mongoose(): mongoose.Model<IImageModelMongoose> {
    return _model;
  };

  get mongooseDocument(): Promise<IImageModelMongoose> {
    let self = this;

    return new Promise((resolve, reject) => {
      if (!self._document) {
        _model
          .findOne({_id: self._id})
          .exec()
          .then((image) => {
            self._document = image;
            resolve(image);
          })
          .catch((err) => {
            Logger.warn("Error while querying for instance model. Model object:"
              + util.inspect(self._thisModel) + ". Error: ", err);
            reject(err);
          });
      } else {
        resolve(self._document);
      }
    });
  };

  get id(): string {
    return this._id;
  };

  get cloudinary(): ICloudinary {
    return this._thisModel.cloudinary;
  }

  get clientUrl(): string {
    return this._thisModel.clientUrl;
  }

  get createdAt(): Date {
    return this._thisModel.createdAt;
  };

  get updatedAt(): Date {
    return this._thisModel.updatedAt;
  };

  get activeUser(): string {
    return (this._thisModel.activeUser != null) ? this._thisModel.activeUser.toString() : null;
  };

  get doneAt(): Date {
    return this._thisModel.doneAt;
  };

  get doneByUser(): string {
    return (this._thisModel.doneByUser != null) ? this._thisModel.doneByUser.toString() : null;
  };

  get rejectedAt(): Date {
    return this._thisModel.rejectedAt;
  };

  get rejectedByUser(): string {
    return (this._thisModel.rejectedByUser != null) ? this._thisModel.rejectedByUser.toString() : null;
  };

  get tags(): string[] {
    return this._thisModel.tags;
  };

  get cropAreas(): ICropArea[] {
    return this._thisModel.cropAreas;
  };

  get comment(): string {
    return this._thisModel.comment;
  };

  get status(): eImageStatus {
    return this._thisModel.status;
  };

  get rails(): IRails {
    return this._thisModel.rails;
  };

  get entityId(): string {
    return this._thisModel.entityId;
  };

  get imaginaryId(): string {
    return this._thisModel.imaginaryId;
  };

  get source(): string {
    return this._thisModel.source;
  };

  get requestMetadata(): IRequestMetadata {
    return this._thisModel.requestMetadata;
  };

  get lastError(): IError {
    return this._thisModel.lastError;
  };

  get imaginaryIdOriginal(): string {
    return this._thisModel.imaginaryIdOriginal;
  };

  get nextTask(): INextTask {
    return this._thisModel.nextTask;
  };

  get reportId(): string {
    return this._thisModel.reportId;
  };

  get transactionId(): string {
    return this._thisModel.transactionId;
  };

  get skippedCrop(): boolean {
    return this._thisModel.skippedCrop;
  };

  get requestedSkipCrop(): boolean {
    return this._thisModel.requestedSkipCrop;
  };

  get skippedCropReason(): eSkippedCropReason {
    return this._thisModel.skippedCropReason;
  };

  get forced(): boolean {
    return this._thisModel.forced;
  };

  get cropAreasOriginId(): string {
    return this._thisModel.cropAreasOriginId;
  };

  get singleImage(): string {
    return this._thisModel.singleImage;
  };

  get tsSubmitted(): Date {
    return this._thisModel.tsSubmitted;
  };

  get completedTasks(): eImageTask[] {
    return this._thisModel.completedTasks;
  }

  static resetRetries(query: object) {
    return new Promise((resolve, reject) => {
      Logger.debug("reset retries for error images with the query: ", JSON.stringify(query));
      _model.updateMany(query, {"$set": {"nextTask.retries": 0, 'status': eImageStatus.waitingTask}})
        .then(resolve)
        .catch(reject)
    })
  }

  static findById(imageId: string): Promise<ImageModel> {
    let logMessage = "Find image by id: " + imageId;

    if (!Helpers.isObjectId(imageId)) {
      Logger.info(logMessage + " is not a legal ObjectId");
      return Promise.resolve(null)
    }

    // It's a valid ObjectId, proceed with 'findById' call.
    return _model.findById(imageId)
    // .exec()
      .then(image => {
        if (image != null) {
          Logger.debug(logMessage + ". Image:", JSON.stringify(image));
          return new ImageModel(image);
        } else {
          Logger.warn(logMessage + " was not found");
          return null;
        }
      })
      .catch(err => {
        Logger.error(logMessage + ". Error:", err);
        return Promise.reject(err);
      })
  };

  static findByImaginaryIdOriginal(imaginaryId: string): Promise<ImageModel> {
    return new Promise((resolve: Function, reject: Function) => {
      let logMessage = "Find image by imaginaryIdOriginal: " + imaginaryId;

      if (imaginaryId != null) {
        _model.find({imaginaryIdOriginal: imaginaryId})
          .select({"status": true, "imaginaryIdOriginal": true})
          .read('secondaryPreferred') // read from read replica
          .exec((err, images) => {
            if (err != null) {
              Logger.error(logMessage + ". Error:", err);
              reject(err);
            } else if (images != null && Array.isArray(images) == true && images.length > 0) {
              Logger.debug(logMessage + ". Image:", JSON.stringify(images));
              resolve(images);
            } else {
              Logger.warn(logMessage + " was not found");
              resolve(null);
            }
          })
      } else {
        Logger.info(logMessage + " is not a legal imaginaryId");
        resolve(null);
      }
    });
  };

  static count(query: object): Promise<number> {
    return new Promise((resolve, reject) => {
      return _model
        .count(query)
        .lean()
        .exec((err, count: number) => {
          if (err) {
            Logger.error("Problem querying images. Error:", err);
            reject(null);
            return;
          }

          resolve(count);
        });
    });
  }

  static aggregate(statuses: eImageStatus[]): Promise<object[]> {
    return new Promise((resolve, reject) => {
      return _model
        .aggregate([{$match: {status: {$in: statuses}}}, {$group: {_id: '$status', total: {$sum: 1}}}])
        .exec((err, res: object[]) => {
          if (err) {
            Logger.error("Problem aggregating images status. Error:", err);
            reject(null);
            return;
          }

          resolve(res);
        });
    });
  }

  static find(query: any, options: any): Promise<any> {
    return new Promise((resolve, reject) => {
      return _model
        .find(query, null, options)
        .lean()
        .exec((err, images: any[]) => {
          if (err) {
            Logger.error("Problem querying images. Error:", err);
            reject(null);
            return;
          }

          resolve(images.map((image) => new ImageModel(image)));
        });
    });
  }

  static query(params: any, limit: number, offset: number): Promise<IQueryResult> {
    return new Promise((resolve, reject) => {
      if (!Pagination.isInScope(limit, offset)) {
        let logMessage = "Querying images with illegal pagination values";
        Logger.error(logMessage);
        reject(logMessage);
      }

      let _query: any = Deserializer.imagesQueryParams(params);
      let _options = {skip: offset, limit: limit, sort: {updatedAt: "asc"}};

      if (Object.keys(_query).length === 0) {
        let logMessage = "Querying images without any param is not supported";
        Logger.warn(logMessage);
        reject(logMessage);
      }

      let savedImages;
      return ImageModel
        .find(_query, _options)
        .then((images) => {
          savedImages = images;
          return images ? ImageModel.countQueryResults(_query) : null
        })
        .then((total) => {
          if (total !== null) {
            Logger.debug("Querying images by: " + JSON.stringify(_query) + ". Total results: " + total);
            resolve({total: total, images: savedImages});
            return;
          }

          Logger.warn("Problem querying images ,no results found and query failed");
          resolve(null);
        })
        .catch((err) => reject(err));
    });
  };

  static reportByEntitiesStatuses(): Promise<any> {
    //TODO: add waitingTask
    //TODO: add cropAreas
    return new Promise((resolve, reject) => {
      // ignore images without "entityId"
      let _match: any = {$match: {entityId: {$exists: true}}};
      // group by {entityId, status} and count images for each status
      let _groupEntitiesAndStatuses: any = {
        $group: {
          _id: {entityId: "$entityId", status: "$status"},
          count: {$sum: 1}
        }
      };
      // group by {entityId} and aggregate all status counters as an array
      let _groupEntities: any = {
        $group: {
          _id: "$_id.entityId",
          total: {"$sum": "$count"},
          statuses: {"$push": {name: "$_id.status", count: "$count"}}
        }
      };
      let _sort: any = {$sort: {_id: 1}};

      _model.aggregate([_match, _groupEntitiesAndStatuses, _groupEntities, _sort])
        .read('secondaryPreferred') // read from read replica
        .exec((err, resultsArr: any) => {
          if (err) {
            let logMessage = "Problem querying entities report";
            Logger.error(logMessage + ". Error:", err);
            reject(err);
          } else if (resultsArr && resultsArr.length > 0) {
            let entityCountersDict: Collections.Dictionary<string, IEntityId> = new Collections.Dictionary<string, IEntityId>();

            resultsArr.forEach((entity) => {
              let possibleStatuses: string[] = [eImageStatus[eImageStatus.inProgress], eImageStatus[eImageStatus.done], eImageStatus[eImageStatus.rejected], eImageStatus[eImageStatus.error]];
              let entityCountersObj: IEntityId = {entityId: entity._id, in: entity.total};

              // init all possible statuses with zero
              possibleStatuses.forEach((possibleStatus) => {
                entityCountersObj[possibleStatus] = 0;
              });

              entity.statuses.forEach((status) => {
                let isStatusIncluded: boolean = possibleStatuses.indexOf(status.name) > -1;

                if (isStatusIncluded) entityCountersObj[status.name] = status.count;
              });

              entityCountersDict.setValue(entity._id, entityCountersObj);
            });

            ImageModel.sortByEntityPriorities(entityCountersDict)
              .then((report) => resolve(report))
              .catch((err) => reject(err));
          } else {
            // should never be here
            let logMessage = "Problem querying entities report";
            Logger.warn(logMessage + " , got no results");
            resolve(null);
          }
        });
    })
  };

  static reportByEntitiesStatusInProgress(): Promise<any> {
    return new Promise((resolve: Function, reject: Function) => {
      // aggregate only entities that do have currently inProgress status
      let _matchInProgress: any = {$match: {status: eImageStatus[eImageStatus.inProgress]}};
      // group by entityId and count images under "inProgress" status
      let _groupEntitiesAndStatus: any = {$group: {_id: "$entityId", sum: {$sum: 1}}};
      let _sort: any = {$sort: {_id: 1}};

      _model.aggregate([_matchInProgress, _groupEntitiesAndStatus, _sort])
        .read('secondaryPreferred') // read from read replica
        .exec((err, resultsArr: any) => {
          if (err != null) {
            let logMessage = "Problem aggregating entities by inProgress status";
            Logger.error(logMessage + ". Error:", err);
            reject(err);
          } else {
            let entityCountDict: Collections.Dictionary<string, IEntityId> = new Collections.Dictionary<string, IEntityId>();

            resultsArr.forEach((entity) => {
              let entityCountObj: IEntityId = {entityId: entity._id, inProgress: entity.sum};

              entityCountDict.setValue(entity._id, entityCountObj);
            });

            // list all existing entity ids
            _model.find({entityId: {$exists: true}})
              .read('secondaryPreferred') // read from read replica
              .distinct("entityId", (err, entityIds) => {
                if (err != null) {
                  let logMessage = "Problem querying distinct entity ids";
                  Logger.error(logMessage + ". Error:", err);
                  reject(err);
                } else {
                  entityIds.forEach((entityId) => {
                    let entityIdStr: string = entityId.toString();
                    let entityCountObj: IEntityId = {entityId: entityIdStr, inProgress: 0};

                    // add missing entity ids
                    if (!entityCountDict.containsKey(entityIdStr))
                      entityCountDict.setValue(entityIdStr, entityCountObj);
                  });

                  if (entityCountDict.isEmpty())
                    return resolve(null);

                  ImageModel.sortByEntityPriorities(entityCountDict)
                    .then((report) => resolve(report))
                    .catch((err) => reject(err));
                }
              })
          }
        });
    })
  };

  static sortByEntityPriorities(entityCountersDict: Collections.Dictionary<string, IEntityId>): Promise<any> {
    Logger.debug(`Sorting by priorities ${entityCountersDict.size()} entities objects`);

    return new Promise((resolve: Function, reject: Function) => {
      ConfigModel.getConfig()
        .then((config) => config.getEntityPrioritiesSorted(true))
        .then((entityPriorities: string[]) => {
          let sortedByEntityPriorityArray: IEntityId[] = [];

          if (entityPriorities != null && entityPriorities.length > 0) {
            Logger.debug(`Sorting ${entityCountersDict.size()} entities by ${entityPriorities.length} priorities`);

            entityPriorities.forEach((priority: string) => {
              let entityCountersObj: IEntityId = entityCountersDict.getValue(priority);

              if (entityCountersObj != null)
                sortedByEntityPriorityArray.push(entityCountersObj);

              // remove from counters dictionary (that include all of the entities in the system)
              // if some entity doesn't included in the priorities list, will add it to the bottom of return list
              entityCountersDict.remove(priority);
            });

            entityCountersDict.values().forEach((entityCountersObj) => {
              sortedByEntityPriorityArray.push(entityCountersObj);
            });

            Logger.info(`Returning ${sortedByEntityPriorityArray.length} entities objects`);
          } else { // no priorities, backward compatibility
            sortedByEntityPriorityArray = entityCountersDict.values();

            Logger.info(`Returning ${sortedByEntityPriorityArray.length} entities objects (without entity priority sorting. entity priorities not found)`);
          }

          resolve(sortedByEntityPriorityArray);
        })
        .catch((err) => {
          Logger.error(`Failed sort by entity priorities: ${JSON.stringify(err)}`);
          reject(`Failed sort by entity priorities: ${JSON.stringify(err)}`);
        })
    })
  }

  static reportByUsers(fromDate: Date, toDate: Date): Promise<any> {
    Logger.info(`Executing users report fromDate="${fromDate}", toDate="${toDate}"`);
    return new Promise((resolve: Function, /*reject: Function*/) => {
      let mappedCounters: any = {};

      // crop areas by user
      let _unwindCropAreas: any = {$unwind: "$cropAreas"};
      let _matchCropAreaCreation: any = {$match: {"cropAreas.createdAt": {$gte: fromDate, $lt: toDate}}};
      let _groupByUserCropAreas: any = {$group: {_id: "$cropAreas.createdByUserId", count: {$sum: 1}}};

      // done by user
      let _matchDoneAt: any = {$match: {"doneByUser": {$exists: true}, "doneAt": {$gte: fromDate, $lt: toDate}}};
      let _groupByUserDone: any = {$group: {_id: "$doneByUser", count: {$sum: 1}}};

      // rejected by user
      let _matchRejectedAt: any = {
        $match: {
          "rejectedByUser": {$exists: true},
          "rejectedAt": {$gte: fromDate, $lt: toDate}
        }
      };
      let _groupByUserRejected: any = {$group: {_id: "$rejectedByUser", count: {$sum: 1}}};

      const mergeResults = (resultsArr: any[], counterName: string, mappedCounters: object) => {
        if (resultsArr && resultsArr.length > 0) {
          resultsArr.forEach((counterByUser) => {
            let countObj = mappedCounters[counterByUser._id] ? mappedCounters[counterByUser._id] : {};

            countObj[counterName] = counterByUser.count;
            mappedCounters[counterByUser._id] = countObj;
          });

          Logger.info(`Returning ${resultsArr.length} user "${counterName}" counters`);
        } else {
          let logMessage = "Problem querying users report";
          Logger.warn(logMessage + " , got no results");
        }
      };

      const doAggregate = (aggArr: any[], counterName: string, mappedCounters: object): Promise<any> => {
        return new Promise((resolve: Function, reject: Function) => {
          _model.aggregate(aggArr)
            .read('secondaryPreferred') // read from read replica
            .exec((err, resultsArr: any[]) => {
              if (err) {
                let logMessage = `Problem querying users "${counterName}" counter for report`;
                Logger.error(logMessage + ". Error:", err);
                reject(err);
                return;
              }

              mergeResults(resultsArr, counterName, mappedCounters);
              resolve()
            })
        })
      };
      // strat a chain
      doAggregate([_unwindCropAreas, _matchCropAreaCreation, _groupByUserCropAreas], "cropAreas", mappedCounters)
        .then(() => doAggregate([_matchDoneAt, _groupByUserDone], "done", mappedCounters))
        .then(() => doAggregate([_matchRejectedAt, _groupByUserRejected], "rejected", mappedCounters))
        .then(() => {
          if (mappedCounters != null && Object.keys(mappedCounters).length > 0)
            resolve(mappedCounters);
          else
            resolve(null);
        })
    })
  };

  static reportByEntities(fromDate: Date, toDate: Date): Promise<any> {
    Logger.info(`Executing entities report fromDate="${fromDate}", toDate="${toDate}"`);
    return new Promise((resolve: Function, /*reject: Function*/) => {

      let mappedCounters: any = {};

      // crop areas by entityId
      let _unwindCropAreas: any = {$unwind: "$cropAreas"};
      let _matchCropAreaCreation: any = {$match: {"cropAreas.createdAt": {$gte: fromDate, $lt: toDate}}};
      let _groupCropAreasByEntityId: any = {$group: {_id: "$entityId", count: {$sum: 1}}};

      // done by entityId
      let _matchDoneAt: any = {$match: {"doneByUser": {$exists: true}, "doneAt": {$gte: fromDate, $lt: toDate}}};
      let _groupByEntityIdDone: any = {$group: {_id: "$entityId", count: {$sum: 1}}};

      // rejected by entityId
      let _matchRejectedAt: any = {
        $match: {
          "rejectedByUser": {$exists: true},
          "rejectedAt": {$gte: fromDate, $lt: toDate}
        }
      };
      let _groupByEntityIdRejected: any = {$group: {_id: "$entityId", count: {$sum: 1}}};

      // createdAt by entityId
      let _matchCreatedAt: any = {$match: {"createdAt": {$gte: fromDate, $lt: toDate}}};
      let _groupByEntityIdCreatedAt: any = {$group: {_id: "$entityId", count: {$sum: 1}}};

      const mergeResults = (resultsArr: any[], counterName: string, mappedCounters: object) => {
        if (resultsArr != null && resultsArr.length > 0) {
          resultsArr.forEach((counterByEntityId) => {
            let countObj = mappedCounters[counterByEntityId._id] != null ? mappedCounters[counterByEntityId._id] : {};

            countObj[counterName] = counterByEntityId.count;
            mappedCounters[counterByEntityId._id] = countObj;
          });

          Logger.info(`Returning ${resultsArr.length} entities "${counterName}" counters`);
        } else {
          let logMessage = "Problem querying entities report";
          Logger.warn(logMessage + " , got no results");
        }
      };

      const doAggregate = (aggArr: any[], counterName: string, mappedCounters: object): Promise<any> => {
        return new Promise((resolve: Function, reject: Function) => {
          _model.aggregate(aggArr)
            .read('secondaryPreferred') // read from read replica
            .exec((err, resultsArr: any) => {
              if (err != null) {
                let logMessage = `Problem querying entities "${counterName}" counter for report`;
                Logger.error(logMessage + ". Error:", err);
                reject(err);
                return;
              }

              mergeResults(resultsArr, counterName, mappedCounters);
              resolve()
            })
        })
      };

      doAggregate([_unwindCropAreas, _matchCropAreaCreation, _groupCropAreasByEntityId], "cropAreas", mappedCounters)
        .then(() => doAggregate([_matchDoneAt, _groupByEntityIdDone], "done", mappedCounters))
        .then(() => doAggregate([_matchRejectedAt, _groupByEntityIdRejected], "rejected", mappedCounters))
        .then(() => doAggregate([_matchCreatedAt, _groupByEntityIdCreatedAt], "created", mappedCounters))
        .then(() => {
          if (mappedCounters != null && Object.keys(mappedCounters).length > 0) {
            resolve(mappedCounters);
          } else {
            resolve(null)
          }
        })
    })
  };

  static getNext(fetcher: IImageFetcher, entityId?: string, pickOneForCrop?:boolean): Promise<ImageModel> {
    if (pickOneForCrop) {
      return fetcher.fetch(entityId != null ? entityId.toString() : null, pickOneForCrop);
    } else {
      return fetcher.fetch(entityId != null ? entityId.toString() : null);
    }
  };

  // return next image need to perform a task
  static nextWaitingTask(retryIntervalMinutes, maxRetries: number): Promise<ImageModel> {
    return new Promise((resolve, reject) => {
      let timeRetryAllowed: Date = new Date(Helpers.subtractMinutesFromNow(retryIntervalMinutes));

      let _query: any = {
        status: {
          $in: [
            eImageStatus[eImageStatus.waitingTask],
            eImageStatus[eImageStatus.sendingToQueue], // probably process stopped while while machine shut down
          ]
        },
        "nextTask.task": {$exists: true},
        "nextTask.retries": {$lte: maxRetries},
        $or: [
          {"nextTask.lastRetry": {$exists: false}},
          {"nextTask.lastRetry": {$lt: timeRetryAllowed}}
        ]
      };

      let _update: any = {"nextTask.lastRetry": Date.now()};

      // Following has been disabled, because the order of handling doesn't really matter. However, using sort entails a huge overhead on the query.
      // When there are a lot of documents to retry the time it takes to execute the query gradually grows and causes the whole process to slow down.
      // return the oldest one first
      // let _options: any = {sort: {"nextTask.lastRetry": 1}, new: true};
      let _options: any = {new: true}; // Not clear why this is necessary. According to the documentation, there is no such option

      Logger.debug(`Querying for image need a task execution, timeRetryAllowed=${timeRetryAllowed}, maxRetries=${maxRetries}`);

      // doing findOneAndUpdate in order to lock by setting value in "lastRetry"
      _model.findOneAndUpdate(_query, _update, _options)
        .exec((err, image) => {
          if (err) {
            let message: string = `Error while querying for image need a task execution`;

            Logger.error(message, err);
            reject(new Error(message));
          } else if (image) {
            let message: string = `Image need a task execution found: image.id=${image.id}`;

            Logger.info(message);
            resolve(new ImageModel(image));
          } else {
            Logger.debug(`No image found for a task execution`);
            resolve(null);
          }
        })
    });
  };

  static create(image: IImageModel): Promise<ImageModel> {
    if (_.isEmpty(image)) {
      return Promise.reject(new TypeError('Image is not a valid object.'));
    }

    let _image = new _model(image);
    return _image.save()
      .then((img) => {
        Logger.debug("Image created", img.id);
        return new ImageModel(img);
      })
      .catch(err => {
        Logger.error("Could not create image ", err);
        return Promise.reject(err);
      })
  };

  static updateStatus(image: ImageModel, userId: string, status: eImageStatus, comment?: string, clientUrl?: string, newAttr?:object): Promise<boolean> {
    return image.updateStatus(userId, status, comment, clientUrl, newAttr);
  };

  static setCropAreaImage(image: ImageModel, cropAreaId: string, imaginaryId: string, cloudinaryId: string, type: string): Promise<ICropArea> {
    return image.setCropAreaImage(cropAreaId, imaginaryId, cloudinaryId, type);
  };

  static updateCropAreaImage(image: ImageModel, imaginaryId: string, cloudinaryId: string, type: string): Promise<ICropArea> {
    return image.updateCropAreaForMultiPages(imaginaryId, cloudinaryId, type);
  };

  static setCropAreaInvoice(image: ImageModel, cropAreaId: string, invoiceId: string): Promise<ICropArea> {
    return image.setCropAreaInvoice(cropAreaId, invoiceId);
  };

  static setError(image: ImageModel, failedTask?: eImageTask): Promise<IImageModel> {
    return image.setError(failedTask);
  };

  static setCropAreaPreProcess(imageId: string, cropAreaId: string, actions: string[]): Promise<any> {
    return new Promise((resolve: Function, reject: Function) => {

      Logger.debug(`setting cropArea enqueued for imageId=${imageId} and cropAreaId=${cropAreaId}`);

      _model.findOneAndUpdate(
        {_id: imageId, "cropAreas._id": cropAreaId},
        {$set: {"cropAreas.$.preProcess.actions": actions}},
        {new: true})
        .then((updatedImage) => {
          //no image was modified
          if (updatedImage == null) {
            let msg = `Could not save pre process actions details for cropArea.id=${cropAreaId} (not exist?)`;
            Logger.error(msg);
            reject(msg);
          } else {
            Logger.debug(`CropArea.id=${cropAreaId} was successfully saved with pre process actions details`);
            resolve(updatedImage);
          }
        })
        .catch((err) => {
          Logger.error(`Could not save pre process actions details for cropArea.id=${cropAreaId}`, err);
          reject(err);
        });
    });
  };

  static setCropAreaEnqueued(imageId: string, cropAreaId: string, messageId: string): Promise<IImageModel> {
    return new Promise((resolve: Function, reject: Function) => {

      Logger.debug(`setting cropArea enqueued for imageId=${imageId} and cropAreaId=${cropAreaId}`);

      _model.findOneAndUpdate({_id: imageId, "cropAreas._id": cropAreaId},
        {$set: {"cropAreas.$.queue.enqueuedAt": Date.now(), "cropAreas.$.queue.messageId": messageId}},
        {new: true})
        .exec()
        .then((updatedImage) => {
          //no image was modified
          if (updatedImage == null) {
            let msg = `Could not save enqueue details for cropArea.id=${cropAreaId} (not exist?)`;
            Logger.error(msg);
            reject(msg);
          } else {
            Logger.debug(`CropArea.id=${cropAreaId} was successfully saved with enqueue details`);
            const imageModel = new ImageModel(updatedImage);
            resolve(imageModel);
          }
        })
        .catch((err) => {
          Logger.error(`Could not save enqueue details for cropArea.id=${cropAreaId}`, err);
          reject(err);
        });
    });
  };

  static setCropAreaTransactionId(imageId: string, cropAreaId: string, override = false): Promise<IImageModel> {
    let _query, _update, _set, _unset;

    if (override) { // override, messageId can be exists, will be unset
      _query = {_id: cropAreaId};
      _set = {"cropAreas.$.queue.transactionId": new mongoose.Types.ObjectId(Date.now())};
      _unset = {"cropAreas.$.queue.messageId": "", "cropAreas.$.queue.enqueuedAt": ""};
      _update = {$set: _set, $unset: _unset};
    } else { // don't override - messageId not exists, transactionId not exists
      _query = {_id: cropAreaId, "queue.messageId": {$exists: false}, "queue.transactionId": {$exists: false}};
      _set = {"cropAreas.$.queue.transactionId": new mongoose.Types.ObjectId(Date.now())};
      _update = {$set: _set};
    }

    Logger.debug(`setting cropArea transactionId to imageId=${imageId} and cropAreaId=${cropAreaId}. override=${override}`);
    return new Promise((resolve: Function, reject: Function) => {
      _model.findOneAndUpdate({_id: imageId, cropAreas: {$elemMatch: _query}}, _update, {new: true})
        .exec()
        .then((updatedImage) => {
          //no image was modified
          if (updatedImage == null) {
            let msg = `Could not create "queue.transactionId" for cropArea.id=${cropAreaId} (CA not exist? transactionId already exist?)`;
            Logger.error(msg);
            reject(msg);
          } else {
            Logger.debug(`CropArea.id=${cropAreaId} was successfully saved with "queue.transactionId"`);
            resolve(updatedImage);
          }
        })
        .catch((err) => {
          Logger.error(`Could not save "queue.transactionId" for cropArea.id=${cropAreaId}`, err);
          reject(err);
        });
    });
  };

  static updateTaskCompleted(image: IImageModel, completedTask: eImageTask, nextTask: eImageTask): Promise<IImageModel> {
    const query = {_id: image.id};
    const update = {
      $set: {
        'nextTask.task': nextTask,
        'nextTask.retries': 0,
        updatedAt: Date.now(),
      },
      $addToSet: {completedTasks: completedTask},
      $unset: {'nextTask.lastRetry': ''}
    };

    return _model
      .findOneAndUpdate(query, update, {new: true})
      .exec()
      .then((updatedImage) => {
        //no image was modified
        if (!updatedImage) {
          Logger.debug(`couln'd update image nextTask status for image: ${image.id}`);
          return Promise.resolve(null);
        }

        Logger.debug(`image nextTask status updated successfully for image: ${image.id}`);
        return new ImageModel(updatedImage);
      })
      .catch((err) => {
        Logger.error(`Update image nextTask status for image.id=${image.id} had error`, err);
        return Promise.reject(err);
      });

  };

  // transaction id for image without cropAreas
  static setImageTransactionId(imageId: string, override = false): Promise<IImageModel> {
    let _update = {$set: {transactionId: new mongoose.Types.ObjectId(Date.now())}};
    let _query;

    if (override) {
      _query = {_id: imageId};
    } else {
      _query = {_id: imageId, transactionId: {$exists: false}};
    }

    return new Promise((resolve: Function, reject: Function) => {
      _model.findOneAndUpdate(_query, _update, {new: true})
        .exec()
        .then((updatedImage) => {
          //no image was modified
          if (updatedImage == null) {
            let msg = `Could not create transactionId for image.id=${imageId} (image not exist? transactionId already exist?)`;
            Logger.error(msg);
            reject(msg);
          } else {
            Logger.debug(`Image.id=${imageId} was successfully saved with transactionId`);
            resolve(updatedImage);
          }
        })
        .catch((err) => {
          Logger.error(`Could not save transactionId for image.id=${imageId}`, err);
          reject(err);
        });
    });
  };

  private static countQueryResults(query: any): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!query) return resolve(0);

      _model.count(query)
        .exec((err, count) => {

          let logMessage = "Problem count images querying";

          if (err != null) {
            Logger.error(logMessage + ". Error:", err);
            reject(err);
          } else if (count != null) {
            resolve(count);
          } else {
            Logger.warn(logMessage + " was not found");
            resolve(0);
          }
        })
    });
  };

  private saveId(imageModel: IImageModel) {
    if ((<IImageModelMongoose>imageModel)._id != null)
      this._id = (<IImageModelMongoose>imageModel)._id.toString();
  };

  private static badFileCounter(count) {
    //Method to count potentiallyBadFile status retryCount located in config.json
    return (count < retryCount);
  };

  private updateStatus(userId: string, status: eImageStatus, comment?: string, clientUrl?: string, newAttr?:any): Promise<boolean> {
    let self = this;
    return new Promise((resolve: Function, reject: Function): void => {
      // if (!Helpers.isObjectId(userId)) {
      //   Logger.info("userId: " + userId + " is not a legal ObjectId");
      //   return resolve(false);
      // }
      //Add the new propeties to accept badFile and potentiallyBadFile statuses
      if (status === eImageStatus.waitingTask || status === eImageStatus.done || status === eImageStatus.rejected || status === eImageStatus.creatingInvoices || status === eImageStatus.sendingToQueue || status === eImageStatus.potentiallyBadFile || status === eImageStatus.badFile) {
        self.mongooseDocument
          .then((imageDoc) => {
            if (imageDoc.status === eImageStatus.error)
              metrics.increment("error_status_recovers");

            imageDoc.status = status;
            imageDoc.updatedAt = new Date();

            if (comment != null) imageDoc.comment = comment; // do not override with empty value
            if (clientUrl != null) imageDoc.clientUrl = clientUrl; // do not override with empty value

            if (status === eImageStatus.waitingTask) {
              if(newAttr && newAttr.skippedCrop) {
                //status = eImageStatus.waitingTask;
                imageDoc.skippedCrop = newAttr.skippedCrop;
                imageDoc.skippedCropReason = newAttr.skippedCropReason;
                imageDoc.nextTask.task = newAttr.nextTask;
                imageDoc.cropAreas = newAttr.cropAreas;
                imageDoc.nextTask.retries = 0;
                delete imageDoc.nextTask.lastRetry;
              } else {
                console.log('going here on wating task');
                imageDoc.doneAt = new Date();
                imageDoc.doneByUser = userId;

                imageDoc.nextTask.task = eImageTask.processComplete;

                imageDoc.nextTask.retries = 0;
                delete imageDoc.nextTask.lastRetry;
              }

            } else if (status === eImageStatus.rejected) {
              imageDoc.rejectedAt = new Date();
              imageDoc.rejectedByUser = userId;

            } else if (status === eImageStatus.potentiallyBadFile) {
              imageDoc.detectionCount++; // Increment Detection counts
              imageDoc.updatedAt = new Date(); // set updatedAt property to current time
              imageDoc.detectedByUser = userId; // set Detection by current User
              imageDoc.status = ImageModel.badFileCounter(imageDoc.detectionCount) ? eImageStatus.potentiallyBadFile : eImageStatus.badFile; // set file status
            } else if (status === eImageStatus.badFile) {
              //Just set status to badFile
              imageDoc.detectedByUser = userId; // set Detection by current User
              imageDoc.detectionCount = retryCount;

            } else if (status === eImageStatus.done) {
              // if(newAttr && newAttr.skippedCrop) {
              //   imageDoc.skippedCrop = newAttr.skippedCrop;
              //   imageDoc.skippedCropReason = newAttr.skippedCropReason;
              //   imageDoc.nextTask.task = newAttr.nextTask;
              //   imageDoc.cropAreas = newAttr.cropAreas;
              //   imageDoc.nextTask.retries = 0;
              // }
            }

            imageDoc.save((err, image) => {
              if (err == null) {
                Logger.debug("Status updated for image.id=" + self.id + " with status " + eImageStatus[status]);
                self._thisModel = image; // updating values for instance model;
                return resolve(true);
              } else {
                Logger.error("Could not save status for image.id=" + imageDoc._id, err.message);
                return reject(err.message);
              }
            })
          })
          .catch((err) => {
            Logger.error("Instance mongoose document was not available. image.id=" + self._id);
            return reject(err)
          })
      } else {
        Logger.warn("Could not update image.id=" + self.id + " with status " + eImageStatus[status]);
        return resolve(false);
      }
    });
  };

  public logTaskFailure(errorMessage: string[], failedTask: eImageTask, incrementRetries: boolean = true): Promise<IImageModel> {
    let self = this;
    return new Promise((resolve, reject) => {

      Logger.debug(`Logging task execution failure: error="${errorMessage}" for image.id="${self.id}"`);

      self.mongooseDocument
        .then((imageDoc) => {
          let errors: IError[] = errorMessage.map(message => ({message, occurredAt: new Date(), task: failedTask}));

          // for image documents have not initiated this value yet
          if (!imageDoc.nextTask) {
            imageDoc.nextTask = {
              task: failedTask,
              errorLog: errors,
              retries: incrementRetries ? 1 : 0,
              lastRetry: new Date()
            }
          } else {
            imageDoc.nextTask.task = failedTask;

            if (imageDoc.nextTask.errorLog) imageDoc.nextTask.errorLog.push(...errors);
            else imageDoc.nextTask.errorLog = errors;

            if (incrementRetries) {
              imageDoc.nextTask.retries =
                imageDoc.nextTask.retries === undefined ? 1 : ++imageDoc.nextTask.retries;
            }

            imageDoc.nextTask.lastRetry = new Date();
          }

          //set the updatedAt
          imageDoc.updatedAt = new Date();

          imageDoc.save((err, image) => {
            if (err) {
              let message = `Imaginary conversion error="${errorMessage}" for image.id="${self.id}" was NOT logged`;
              Logger.error(message, err);
              reject(new Error(message + JSON.stringify(err)));
            } else if (image) {
              self._thisModel = image; // updating values for instance model;
              Logger.info(`Imaginary conversion error="${errorMessage}" for image.id="${self.id}" was logged`);
              resolve(new ImageModel(image));
            } else {
              let message = `Imaginary conversion log error was failed, could not find image.id="${self.id}"`;
              Logger.error(message, err);
              reject(new Error(message + JSON.stringify(err)));
            }
          })
        })
        .catch((err) => {
          let message = `Instance mongoose document was not available. image.id="${self.id}"`;
          Logger.error(message, err);
          reject(new Error(message + JSON.stringify(err)))
        })
    });
  };

  // TODO: test
  public closeTask(): Promise<boolean> {
    let self = this;
    return new Promise((resolve, reject): void => {
      Logger.debug(`Closing task for image.id="${self.id}, task="${eImageTask[self.nextTask.task]}"`);

      self.mongooseDocument
        .then((imageDoc) => {

          // remove values specific to last task
          if (imageDoc.nextTask) {
            imageDoc.nextTask.task = undefined;
            imageDoc.nextTask.retries = undefined;
            imageDoc.nextTask.lastRetry = undefined;
          }

          //set the updatedAt
          imageDoc.updatedAt = new Date();

          return imageDoc.save((err, image) => {
            if (err) {
              let message = `Task closing error for image.id="${self.id}"`;
              Logger.error(message, err);
              reject(new Error(message + JSON.stringify(err)));
            } else if (image) {
              self._thisModel = image; // updating values for instance model;
              Logger.info(`Task closed for image.id="${self.id}"`);
              resolve(true);
            } else {
              let message = `Task closing error for image.id="${self.id}"`;
              Logger.error(message, err);
              reject(new Error(message + JSON.stringify(err)));
            }
          })
        })
        .catch((err) => {
          let message = `Task closing error for image.id="${self.id}"`;
          Logger.error(message, err);
          reject(new Error(message + JSON.stringify(err)))
        })
    });
  };

  public createCropArea(userId: string, cropArea: any): Promise<ICropArea> {
    let self = this;
    return new Promise((resolve: Function, reject: Function): void => {
      if (!Helpers.isObjectId(userId)) {
        Logger.info("UserId: " + userId + " is not a legal ObjectId");
        return resolve(null);
      } else if (cropArea != null && cropArea.x != null && cropArea.y != null && cropArea.width != null && cropArea.height != null) {
        self.mongooseDocument
          .then((imageDoc) => {

            // TODO: add cloudinary values
            let newCropArea = {
              x: <number>cropArea.x,
              y: <number>cropArea.y,
              width: <number>cropArea.width,
              height: <number>cropArea.height,
              updatedAt: new Date(),
              createdAt: new Date(),
              createdByUserId: userId,
              status: eCropAreaStatus.fresh
            };

            //push the new crop area
            let newCropIndex = imageDoc.cropAreas.push(newCropArea) - 1;

            //set the updatedAt
            imageDoc.updatedAt = new Date();

            imageDoc.save((err, image) => {
              if (!err && newCropIndex >= 0) {
                Logger.debug("CropArea for image.id=" + image.id
                  + " was created at index " + newCropIndex + ". CropArea=" + JSON.stringify(image.cropAreas[newCropIndex]));
                self._thisModel = image; // updating values for instance model;
                resolve(image.cropAreas[newCropIndex]);
              } else if (err) {
                Logger.error("Could not save cropArea for image.id=" + imageDoc._id, err);
                reject(err);
              } else {
                Logger.error("Could not save cropArea for image.id="
                  + imageDoc._id + ", new cropArea array index=" + newCropIndex);
                reject(null);
              }
            })
          })
          .catch((err) => {
            Logger.error("Instance mongoose document was not available. image.id=" + self._id);
            reject(err)
          })
      } else {
        let logMessage = "Could not create cropArea for image.id=" + self.id + " missing params in body=" + JSON.stringify(cropArea);
        Logger.error(logMessage);
        return reject(logMessage);
      }

    });
  };

  public deleteCropArea(cropAreaId: string): Promise<boolean> {
    let self = this;
    let _promise = (resolve: Function, reject: Function): void => {
      if (!Helpers.isObjectId(cropAreaId)) {
        Logger.info("cropAreaId: " + cropAreaId + " is not a legal ObjectId");
        return resolve(false);
      }

      //update updatedAt and test
      _model.findOneAndUpdate({_id: self.id, "cropAreas._id": cropAreaId},
        {$pull: {"cropAreas": {_id: cropAreaId}}, $set: {updatedAt: Date.now(),}},
        {new: true})
        .exec()
        .then((updatedImage) => {
          //no image was modified
          if (!updatedImage) {
            Logger.debug(`no cropAreas were deleted for image.id=${self.id} and cropArea.id=${cropAreaId}`);
            return resolve(false);
          }

          //update the image model
          self._thisModel = updatedImage;

          Logger.debug(`cropAreas were deleted for image.id=${self.id} and cropArea.id=${cropAreaId}`);
          return resolve(true);
        })
        .catch((err) => {
          Logger.error(`Could not delete cropArea for image.id=${self.id} and cropArea.id=${cropAreaId}`, err);
          return reject(err);
        });
    };

    return new Promise<boolean>(_promise);
  };

  public queueComplete(userId: string, comment: string, clientUrl: string): Promise<boolean> {
    if (this.status !== eImageStatus.inProgress && this.status !== eImageStatus.done && this.status !== eImageStatus.rejected && this.status !== eImageStatus.potentiallyBadFile) { // added the ability to make potentiallyBadFile to done --Jr
      Logger.debug("Status for image.id=" + this.id
        + " could not change from " + eImageStatus[this.status] + " to " + eImageStatus[eImageStatus.done]);
      return Promise.resolve(false);
    }

    if (!this.cropAreas || this.cropAreas.length === 0) {
      const msg = "Can't complete image without cropAreas";
      Logger.warn(msg);
      return Promise.reject(msg);
    }

    return ImageModel.updateStatus(this, userId, eImageStatus.waitingTask, comment, clientUrl);
  };

  public skipCrop(userId: string, comment: string, clientUrl: string, reqToSkip: any): Promise<boolean> {
    if (this.status !== eImageStatus.inProgress && this.status !== eImageStatus.done && this.status !== eImageStatus.rejected && this.status !== eImageStatus.potentiallyBadFile) { // added the ability to make potentiallyBadFile to done --Jr
      Logger.debug("Status for image.id=" + this.id
        + " could not change from " + eImageStatus[this.status] + " to " + eImageStatus[eImageStatus.done]);
      return Promise.resolve(false);
    }

    let newImgAttr: {[key: string]: any} = {};

    if(reqToSkip && reqToSkip.isValid) {
      newImgAttr.skippedCrop = reqToSkip.isValid;
      newImgAttr.skippedCropReason = reqToSkip.reason === eSkippedCropReason.multiPages ? eSkippedCropReason.multiPages : eSkippedCropReason.image;
      newImgAttr.nextTask = reqToSkip.reason === eSkippedCropReason.multiPages ? eImageTask.multipageConversion : eImageTask.processComplete;
      // ? {task: eImageTask.multipageConversion, retries: 0}
      // : {task:eImageTask.processComplete, retries:0};
      newImgAttr.cropAreas = [{createdAt: new Date(), imaginaryId: reqToSkip.imaginaryIdOriginal}];
    }

    return ImageModel.updateStatus(this, userId, eImageStatus.waitingTask, comment, clientUrl, newImgAttr);
  }

  public reject(userId: string, comment: string, clientUrl: string): Promise<boolean> {
    if (this.status === eImageStatus.inProgress || this.status === eImageStatus.rejected) {
      metrics.histogram("rejected_reports");

      return ImageModel.updateStatus(this, userId, eImageStatus.rejected, comment, clientUrl)
    } else {
      Logger.debug("Status for image.id=" + this.id
        + " could not change from " + eImageStatus[this.status] + " to " + eImageStatus[eImageStatus.rejected]);
      return Promise.resolve(false);
    }
  };

  //method to set potentiallyBadFile
  public setPotentiallyBadFile(userId: string, comment: string, clientUrl: string): Promise<boolean> {
    return ImageModel.updateStatus(this, userId, eImageStatus.potentiallyBadFile, 'Image couldn\'t be displayed. Possibly not an image file', clientUrl);
  };

//method to set badFile
  public setBadFile(userId: string, comment: string, clientUrl: string): Promise<boolean> {
    return ImageModel.updateStatus(this, userId, eImageStatus.badFile, 'Image failed multiple retries to be displayed. Probably not an image file.', clientUrl);
  };

  // TODO: test
  public setError(failedTask?: eImageTask): Promise<IImageModel> {
    let self = this;
    return new Promise((resolve: Function, reject: Function) => {

      let failedTaskTextPart: string = failedTask ? ` of task="${eImageTask[failedTask]}"` : "";

      Logger.debug(`Setting error for image.id=${self.id}${failedTaskTextPart}.`);

      let _update: any = {
        status: eImageStatus.error,
        lastError: {occurredAt: Date.now()},
      };

      if (failedTask != null) {
        _update.lastError.task = failedTask
      }

      return _model.findOneAndUpdate({_id: self.id},
        _update,
        {new: true})
        .exec()
        .then((updatedImage) => {
          //no image was modified
          if (!updatedImage) {
            Logger.info(`Image.id=${updatedImage.id} was saved with status error`);
            resolve(null);
          }

          metrics.increment("status_error_saved");

          //update the image model
          self._thisModel = updatedImage;
          resolve(new ImageModel(updatedImage));
        })
        .catch((err) => {
          Logger.error(`Could not save error for image.id=${self.id}`, err);
          reject(err);
        });
    });
  };

  public setImaginaryData(imaginaryId: string, cloudinary?: ICloudinary): Promise<boolean> {
    let self = this;

    Logger.debug(`Setting imaginary data (imaginaryId="${imaginaryId}", cloudinary data="${JSON.stringify(cloudinary)}"), image.id=${self.id}`);

    let _promise = (resolve: Function, reject: Function): void => {
      self.mongooseDocument
        .then((imageDoc) => {
          imageDoc.imaginaryId = imaginaryId;

          if (cloudinary) {
            imageDoc.cloudinary.publicId = cloudinary.publicId;
            imageDoc.cloudinary.format = cloudinary.format;
          }

          imageDoc.status = eImageStatus.inProgress;
          imageDoc.updatedAt = new Date();

          imageDoc.save((err, image) => {
            if (err == null) {
              Logger.debug(`Successfully saved imaginary data (imaginaryId="${imaginaryId}", cloudinary data="${JSON.stringify(cloudinary)}"), image.id=${self.id}`);
              self._thisModel = image; // updating values for instance model;
              resolve(true);
            } else {
              let message = `Error while saving imaginary data (imaginaryId="${imaginaryId}", cloudinary data="${JSON.stringify(cloudinary)}"), image.id=${self.id}. `;
              Logger.error(message, err);
              reject(new Error(message + JSON.stringify(err)))
            }
          })
        })
        .catch((err) => {
          let message = `Instance mongoose document was not available. image.id="${self.id}". `;
          Logger.error(message, err);
          reject(new Error(message + JSON.stringify(err)))
        })

    };

    return new Promise<boolean>(_promise);
  };

  public setCropAreaImage(cropAreaId: string, imaginaryId: string, cloudinaryId: string, type: string): Promise<ICropArea> {
    let self = this;
    return new Promise((resolve, reject) => {
      self.mongooseDocument
        .then((imageDoc) => {
          let cropArea = imageDoc.cropAreas.find((cropArea) => cropArea.id === cropAreaId); // TODO: maybe can be optimized using $set

          if (cropArea) {

            cropArea.imaginaryId = imaginaryId;
            cropArea.cloudinary.publicId = cloudinaryId;
            cropArea.cloudinary.format = type;
            cropArea.updatedAt = new Date();

            imageDoc.save((err, image) => {
              if (!err) {
                Logger.debug(`Image for cropArea.id=${cropAreaId} on image.id=${self.id} was saved`);
                metrics.increment("created_crop_areas");

                self._thisModel = image; // updating values for instance model;
                resolve(imageDoc.cropAreas.find((cropArea) => cropArea.id === cropAreaId))
              } else {
                Logger.error(`Error while saving crop area image for croparea.id=${cropAreaId}, image.id=${self.id}`, err);
                reject(err);
              }
            })

          } else {
            Logger.warn(`Croparea.id=${cropAreaId} for image.id=${self.id} not exist`);
            resolve(null);
          }
        })
        .catch((err) => {
          Logger.error("Instance mongoose document was not available. image.id=" + self._id);
          reject(err)
        })

    });
  };

  public updateCropAreaForMultiPages(imaginaryId: string, cloudinaryId: string, type: string): Promise<ICropArea> {
    let self = this;

    return new Promise((resolve, reject) => {
      self.mongooseDocument
        .then((imageDoc) => {
          let cropArea = imageDoc.cropAreas && imageDoc.cropAreas[0];

          if (cropArea) {
            cropArea.imaginaryId = imaginaryId;
            cropArea.cloudinary.publicId = cloudinaryId;
            cropArea.cloudinary.format = type;
            cropArea.updatedAt = new Date();

            imageDoc.save((err, image) => {
              if (!err) {
                Logger.debug(`CropArea update for image.id=${self.id} was saved`);
                metrics.increment("created_crop_areas_for_");

                self._thisModel = image; // updating values for instance model;
                resolve(cropArea)
              } else {
                Logger.error(`Error while updating crop area for image.id=${self.id}`, err);
                reject(err);
              }
            })
          } else {
            Logger.warn(`Croparea for image.id=${self.id} not exist`);
            resolve(null);
          }
        })
        .catch((err) => {
          Logger.error("Instance mongoose document was not available. image.id=" + self._id);
          reject(err)
        })

    });
  };

  public setCropAreaInvoice(cropAreaId: string, invoiceId: string): Promise<ICropArea> {

    let self = this;
    let _promise = (resolve: Function, reject: Function): void => {
      if (!cropAreaId || cropAreaId === "" || !invoiceId || invoiceId === "") {
        Logger.warn(`Could not save empty cropAreaId or invoiceId for image.id=${self.id}`);
        return resolve(null);
      }

      self.mongooseDocument
        .then((imageDoc) => {
          let cropArea = imageDoc.cropAreas.find((cropArea) => cropArea.id === cropAreaId);

          if (cropArea) {

            cropArea.invoiceId = invoiceId;
            cropArea.status = eCropAreaStatus.invoiceCreated;
            cropArea.invoiceCreatedAt = new Date();
            cropArea.updatedAt = new Date();

            imageDoc.save((err, image) => {
              if (!err) {
                Logger.debug(`Invoice for cropArea.id=${cropAreaId} on image.id=${self.id} was saved`);
                self._thisModel = image; // updating values for instance model;
                resolve(imageDoc.cropAreas.find((cropArea) => cropArea.id === cropAreaId))
              } else {
                Logger.error(`InvoiceId for cropArea.id=${cropAreaId} on image.id=${self.id} was not saved`, err);
                reject(err);
              }
            })

          } else {
            Logger.warn(`Croparea.id=${cropAreaId} for image.id=${self.id} not exist`);
            resolve(null);
          }

        })
        .catch((err) => {
          Logger.error("Instance mongoose document was not available. image.id=" + self._id);
          reject(err)
        })

    };

    return new Promise<ICropArea>(_promise);
  };

  public saveAsSingleImage(userId: string): Promise<boolean> {

    let self = this;
    return new Promise((resolve: Function, reject: Function) => {
      self.mongooseDocument
        .then((imageDoc) => {

          if (imageDoc.singleImage) {
            var msg = `image.id=${self.id} already saved as single image.`;
            Logger.warn(msg);
            reject(msg)
          }

          imageDoc.status = eImageStatus.waitingTask;

          imageDoc.doneAt = new Date();
          imageDoc.doneByUser = userId;
          imageDoc.nextTask.task = eImageTask.processComplete;
          imageDoc.nextTask.retries = 0;
          delete imageDoc.nextTask.lastRetry;

          imageDoc.singleImage = userId;
          imageDoc.cropAreas = [{
            createdAt: new Date(),
            imaginaryId: imageDoc.imaginaryIdOriginal
          }];

          var cropAreaLog = '';
          imageDoc.save((err, image) => {
            if (err) {
              Logger.error(`Couldn't save image.id=${self.id} as single image`, err);
              reject(`Couldn't save image.id=${self.id} as single image. ${err}`);
              return;
            }

            if (image.cropAreas && image.cropAreas.length > 0) {
              cropAreaLog = `cropArea details=${image.cropAreas[0]}`
            }

            Logger.debug(`image.id=${self.id} was saved as single image. cropArea=${cropAreaLog}`);
            self._thisModel = image; // updating values for instance model;
            resolve('image saved successfully')
          })
        })
        .catch((err) => {
          Logger.error(`Instance mongoose document was not available. image.id=${self._id}; Error:\n${JSON.stringify(err)}`);
          reject("Instance mongoose document was not available. image.id=" + self._id)
        })
    })
  }
}

export default ImageModel;
