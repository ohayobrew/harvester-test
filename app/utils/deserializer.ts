import {Logger} from './logger';
import * as _ from 'lodash';
import {IImageModel, IRequestMetadata, eImageTask, eSkippedCropReason} from '../models/image/image.model.interface'
import {ICropArea} from "../models/image/image.model.interface";
import {eImageStatus} from "../models/image/image.model.interface";
import {eCropAreaStatus} from "../models/image/image.model.interface";
import {IEntityPriority} from "../models/config/config.model.interface";

export interface IParsedRequest {
  imageId: string;
  entityId: string;
  tags?: string[];
  source: string;
  reportId: string;
  requestedSkipCrop: boolean;
  force?: boolean;
  reCalc?: boolean;
  metadata?: IRequestMetadata
};

export class Deserializer {
  // take only supported query params for image filtering
  static imagesQueryParams = (queryParams: any[]): any => {
    if (queryParams == null)
      return {};

    let keys = ["status", "entityId"];
    let returnObj = {};

    keys.forEach(key => {
      if (queryParams[key])
        returnObj[key] = queryParams[key];
    })

    return returnObj;
  };

  // take string status and return the same string if exist in eImagesStatus enum
  static imagesStatusBleach = (status: string): string => {
    let intStatus = parseInt(status);

    if (!isNaN(intStatus))
      return null;

    return eImageStatus[status];
  };

  // convert strings of ints to number
  static paginationScope = (limit: string, offset: string): {limit: number, offset: number} => {
    let intLimit = parseInt(limit);
    let intOffset = parseInt(offset);

    if (isNaN(intLimit) || isNaN(intOffset))
      return null;

    return {limit: intLimit, offset: intOffset};
  };

  // convert string body of incoming message from long poll queue to object with required params
  // if not all required params exist, returning null
  static fromMessageBody = (messageBody: string): IParsedRequest => {
    try {
      let tmpObj = JSON.parse(messageBody);

      Logger.debug(`Message body "${messageBody}" was successfully -parsed- to JSON`);

      // check for mandatory fields
      if (tmpObj.data == null || tmpObj.metadata == null){
        Logger.warn(`Message body "${messageBody}" is missing mandatory fields. IGNORING!`);
        return null;
      }
      else if (tmpObj.metadata.workloadId == null || tmpObj.metadata.transactionId == null || tmpObj.metadata.reportId == null){
        Logger.warn(`Message body "${messageBody}" is missing mandatory fields. IGNORING!`);
        return null;
      }
      else if (tmpObj.data.imageId == null || tmpObj.data.source == null || tmpObj.data.entityId == null){
        Logger.warn(`Message body "${messageBody}" is missing mandatory fields. IGNORING!`);
        return null;
      }

      // optional fields that not exist will not be included in the returned object
      return {
        imageId: tmpObj.data.imageId,
        entityId: tmpObj.data.entityId.toString(),
        tags: tmpObj.data.tags,
        source: tmpObj.data.source,
        reportId: tmpObj.data.reportId,
        requestedSkipCrop: tmpObj.data.skipCrop,
        force: tmpObj.data.force,
        reCalc: tmpObj.data.reCalc,
        metadata: {
          workloadId: tmpObj.metadata.workloadId,
          transactionId: tmpObj.metadata.transactionId,
          reportId: tmpObj.metadata.reportId,
          companyId: tmpObj.metadata.companyId,
          version: tmpObj.metadata.version,
        }
      };
    }
    catch (error) {
      Logger.warn(`Failed parsing message body "${messageBody}" to JSON`, error.message);
      return null;
    }
  };

  private static getCroppedData(cropAreas: ICropArea[], keepCropAreaImaginaryId: boolean): ICropArea[] {
    return cropAreas.map( obj => ({
        createdAt: obj.createdAt,
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
        status: obj.status,
        cloudinary: keepCropAreaImaginaryId ? obj.cloudinary : undefined,
        imaginaryId: keepCropAreaImaginaryId ? obj.imaginaryId : undefined
    }))
  }

  // set proper values when no need cropping, just set the main imaginaryId as a single crop area
  static skipCrop(image: IImageModel): IImageModel {
    return Deserializer.getSerializerImg(
      image, 
      eImageStatus.waitingTask, 
      eImageTask.processComplete, 
      undefined, 
      true,
      eSkippedCropReason.image)
  }

  static skipMultiPage(image: IImageModel): IImageModel {
    return Deserializer.getSerializerImg(
      image, 
      eImageStatus.waitingTask, 
      eImageTask.multipageConversion, 
      undefined, 
      true,
      eSkippedCropReason.multiPages)
  }

  static getCropAreasFromLastExist(newImage: IImageModel, image: IImageModel): IImageModel {
    newImage.cropAreasOriginId = image.id;

    if (newImage.reCalc) {
      const wasSkipped = image.skippedCrop && image.cropAreas.length == 1 && image.cropAreas[0].x == null && !image.activeUser;
      const wasSingleImage = typeof image.singleImage !== "undefined"; // assigned by user, can only do when image type != pdf/tiff
      const wasSkippedImageType = wasSkipped && image.cropAreas[0].imaginaryId == image.imaginaryIdOriginal;
      const keepCropAreaImaginaryId = wasSingleImage || wasSkippedImageType;

      const cropAreas = Deserializer.getCroppedData(image.cropAreas, keepCropAreaImaginaryId);

      // for multi page, we create a new imaginary in the cropArea
      const wasSkippedMultipage = wasSkipped && image.cropAreas[0].imaginaryId != image.imaginaryIdOriginal;

      return Deserializer.getSerializerImg(
        newImage,
        eImageStatus.waitingTask,
        wasSkippedMultipage ? eImageTask.multipageConversion : eImageTask.processComplete,
        cropAreas,
        true,
        eSkippedCropReason.reCalc)

    } else {
      const cropAreas = Deserializer.getCroppedData(image.cropAreas, true);
      return Deserializer.getSerializerImg(newImage, eImageStatus.waitingTask, eImageTask.processComplete, cropAreas)
    }
  }

  private static getSerializerImg(
      image: IImageModel,
      status: eImageStatus,
      nextTask: eImageTask,
      cropAreas: ICropArea[] = undefined,
      skippedCrop: boolean = undefined,
      skippedCropReason: eSkippedCropReason = undefined): IImageModel {
    const returnImg = _.cloneDeep(image);

    returnImg.skippedCrop = skippedCrop;
    returnImg.skippedCropReason = skippedCropReason;
    returnImg.status = status;
    returnImg.cropAreas = cropAreas ? cropAreas : [{ createdAt: new Date(), imaginaryId: returnImg.imaginaryIdOriginal}];

    returnImg.nextTask = { task: nextTask, retries: 0};

    return returnImg;
  }

  // most significant priority will have max value
  static entityPriorities(orderedEntities: string[]): IEntityPriority[] {
    if (orderedEntities == null || !(orderedEntities instanceof Array))
      return;

    return orderedEntities
      .filter(entityId => typeof entityId === "string")
      .map((entityId: string, index: number, arr: string[]) => ({entityId, priority: (arr.length - index), consider: true}) );
  }
}
