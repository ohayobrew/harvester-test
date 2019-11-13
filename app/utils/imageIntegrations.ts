import {Logger} from './logger';
import {QueueApi, eQueues} from './queueApi';
import {utils} from './serializer';
import Serializer = utils.Serializer;
import {ImaginaryService} from '../services/imaginaryService';
import ImageModel from '../models/image/image.model';
import {ICropArea, IImageModel} from '../models/image/image.model.interface';

import UserModel from '../models/user/user.model';
import { PreProcessService } from '../services/preProcessService';
import { ConfigService } from '../services/configService';

const IMAGE_PRE_PROCESS_CONFIG = ConfigService.getConfig('imagePreProcess')
const TASKS_CONFIG = ConfigService.getConfig('tasks')
if (!IMAGE_PRE_PROCESS_CONFIG){
  throw new Error("Couldn't find 'imagePreProcess' field in config")
}

if (!TASKS_CONFIG){
  throw new Error("Couldn't find 'tasks' field in config")
}

const MAX_RETRIES = TASKS_CONFIG.maxRetries

export interface FilteredCropArea {
  index: number;
  cropArea: ICropArea;
}

export default class ImageIntegrations {

  static createCropImages = (image: IImageModel): Promise<void> => {

    const createImage = (image, cropArea): Promise<boolean> => {
       // backward compatibility
       let imaginaryId = image.imaginaryIdOriginal ? image.imaginaryIdOriginal : image.imaginaryId;
       return UserModel.findById(cropArea.createdByUserId)
         .then((user) => {
           let vatboxUserId = (user && user.vatboxUserId) ? user.vatboxUserId : undefined;
           return ImaginaryService.createCropImage(imaginaryId, cropArea, vatboxUserId)}
         )
         .then((res) => ImageModel.setCropAreaImage(image, cropArea.id, res.id, res.cloudinaryId, res.mimeType))
         .then((cropArea) => cropArea !== null ? Promise.resolve(true) : Promise.resolve(false))
         .catch((error) => {
          const msg = `create crop images to imageId=${image.id} failed due to: ${error}`
          Logger.error(msg)
          return Promise.reject(msg)
         })
    };

    const cropAreas = 
        image.cropAreas
        .filter(cropArea => !cropArea.imaginaryId)
    
    if (cropAreas.length === 0) {
      Logger.debug(`there are no crop areas needed to create images for imageId=${image.id}`)
      return Promise.resolve(null)
    }

    const queries = 
      cropAreas
        .map(cropArea => createImage(image, cropArea))
        .map(promise => promise.then(() => null).catch(error => error))

      return Promise.all(queries).then((resArr) => {
        const errors = resArr.filter(error => error)
        if (errors.length > 0) return Promise.reject(errors)

        Logger.debug(`create crop images to imageId=${image.id} finished successfully`)
        return
      })
  }

  static doPreProcess = (image: IImageModel, cropArea: ICropArea) => {
    if (!cropArea.imaginaryId) {
      Logger.info(`PreProcess: Not found imaginaryId to imageId: ${image.id}, cropAreaId: ${cropArea.id}`)
      return Promise.resolve() 
    }

    // const handleSuccess = 
    const handleFailure = (error) => {
      const msg = `PreProcess: error occure while preprocessing imageId: ${image.id}, cropAreaId: ${cropArea.id}, ${error.message || error}`
      Logger.debug(`PreProcess: error occure while preprocessing imageId: ${image.id}, cropAreaId: ${cropArea.id}`, error)
      Logger.error(msg)
      return Promise.reject(`cropAreaId: ${cropArea.id}, ${error.message}`)
    }

    return PreProcessService
      .manipulateImage(cropArea.imaginaryId)
      .then((res) => {
        return ImageModel.setCropAreaPreProcess(image.id, cropArea.id, res.actions)
      })
      .catch(handleFailure)
  }

  static sendToPreProcess = (image: IImageModel): Promise<string[]> => {

    const isNeedProcess = (cropArea) => {
      const preProcess = cropArea.preProcess
      if (
        preProcess && 
        ((preProcess.tries > MAX_RETRIES) ||
        (preProcess.actions && preProcess.actions.length > 0))
      ) return false

      return true
    }

    const cropAreas = image.cropAreas.filter(isNeedProcess)
    if (cropAreas.length === 0) {
      Logger.debug(`there are no cropareas images to send to pre-process for imageId=${image.id}`)
      return Promise.resolve(null)
    }

    const queries = 
      cropAreas
        .map(cropArea => ImageIntegrations.doPreProcess(image, cropArea))
        .map(promise => promise.then(() => null).catch(error => error))

    return Promise.all(queries)
      .then((resArr) => {
        const errors = resArr.filter(error => error)
        if (errors.length > 0) return Promise.reject(errors)

        Logger.debug(`Pre process finished successefully for imageId=${image.id}`)
        return
      })
  }

  static createTransactionIds = (image: IImageModel): Promise<string[]> => {
    if (image.cropAreas == null || image.cropAreas.length === 0) {
      return image.transactionId == null ? 
        ImageModel.setImageTransactionId(image.id) : Promise.resolve(null)
    }

    // case image have cropAreas
    let filteredCropAreas: ICropArea[] = image.cropAreas.filter((cropArea) => cropArea.queue == null || cropArea.queue.transactionId == null);

    if (filteredCropAreas.length === 0) return Promise.resolve(null)

    let actions = 
      filteredCropAreas
        .map((filteredCropArea) => ImageModel.setCropAreaTransactionId(image.id, filteredCropArea.id))
        .map(promise => promise.then(() => null).catch(error => error))

    return Promise.all(actions) // if one "action" was rejected, Promise.all will reject with the reason
      .then((resArr) => {
        const errors = resArr.filter(error => error)
        if (errors.length > 0) return Promise.reject(errors)

        Logger.debug(`createTransactionIds finished successefully for imageId=${image.id}`)
        return
      })
  }

  static sendMessageToQueue = (messageObj: any, queue: eQueues): Promise<any> => {

    if (messageObj == null || typeof(messageObj) != "object") {
      const msg = `Message object="${messageObj}" is not familiar format`
      Logger.error(msg)
      return Promise.reject(msg)
    }

    let messageObjStr = JSON.stringify(messageObj.serialized);

    Logger.debug(`Sending cropArea to queue=${eQueues[queue]}, message body="${messageObjStr}"`);

    return QueueApi.send(messageObjStr, queue)
      .then((messageId) => {
        if(messageId == null) {
          // sending message was failed, likely will never reach here
          const msg = `Sending message="${messageObjStr}" to queue=${eQueues[queue]} did not returned messageId"`
          Logger.error(msg)
          return Promise.reject(msg);
        }

        // image have no crop areas
        if(messageObj.cropAreaId != null) {
          return ImageModel.setCropAreaEnqueued(messageObj.imageId, messageObj.cropAreaId, messageId)
        }

        return Promise.resolve(null);
      })
  }

  static sendToQueue(image: IImageModel): Promise<string[]> {
    if (!image) return Promise.reject(`Image can't be null or undefined. Quitting sending queue messages`)

    Logger.debug(`Preparing corpAreas of image.id=${image.id} to be sent via queue`);

    let queue: eQueues = image.cropAreas != null && image.cropAreas.length > 0 ? eQueues.expediteIn : eQueues.matchMergeIn;

    return QueueApi.getQueueUrl(eQueues.matchMergeIn)
      .then((queueUrl) => {
        let returnQueueUrl;
        let returnQueue: eQueues; // in future should replace returnQueueUrl

        // if source is scapegoat, expedite will be the target when there are crop areas, and the return queue url should be announced
        if(queue == eQueues.expediteIn){
          returnQueueUrl = queueUrl;
          returnQueue = eQueues.matchMergeIn;
        }

        // will filter crop areas that was already sent
        let filteredCropAreas: FilteredCropArea[] = ImageIntegrations.filterSentCropAreas(image);
        let queueObjects: any[] = Serializer.toQueueObjects(image, filteredCropAreas, returnQueueUrl, returnQueue);
        let actions = 
          queueObjects
            .map((cropAreaMessageObj) => ImageIntegrations.sendMessageToQueue(cropAreaMessageObj, queue))
            .map(promise => promise.then(() => null).catch(error => error))

        if (actions.length === 0) return Promise.resolve(undefined)

         // if one "action" was rejected, Promise.all will reject with the reason
        return Promise.all(actions)
          .then((resArr) => {
            const errors = resArr.filter(error => error)
            if (errors.length > 0) return Promise.reject(errors)

            Logger.debug(`sendToQueue finished successefully for imageId=${image.id}`)
            return
          })
      })
  }

  public static filterSentCropAreas(image?: IImageModel): FilteredCropArea[] {
    if (image == null)
      return null;

    // hold the original index of each cropArea, in case there are areas that will be skipped
    let returnArray: FilteredCropArea[] = [];

    if (image.cropAreas != null && image.cropAreas.length > 0) {
      // in order to support recovery, filter out crop areas that was already sent
      image.cropAreas.forEach((cropArea, index) => {
        if (cropArea.queue == null || cropArea.queue.messageId == null) {
          returnArray.push({index: index, cropArea: cropArea});

          return true;
        }
        else
          return false;
      });

      if (image.cropAreas.length > returnArray.length)
        Logger.info(`Image.id="${image.id}" have ${returnArray.length} not sent crop areas out of ${image.cropAreas.length}`);
    }

    return returnArray;
  }
}
