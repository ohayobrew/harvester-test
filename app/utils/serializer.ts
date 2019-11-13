import {Logger} from './logger';
import {IImageModel} from '../models/image/image.model.interface'
import {ICropArea} from "../models/image/image.model.interface";
import {eImageStatus} from "../models/image/image.model.interface";
import {eCropAreaStatus} from "../models/image/image.model.interface";
import {FilteredCropArea} from "./imageIntegrations";
import {QueueApi, eQueues} from "./queueApi";

//TODO: move to another config structure
import * as path from 'path';

var configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
let Config = require(configFilePath) || {};

let IMAGINARY_IMAGE = `${Config.imaginaryApi.clientsApiPath}${Config.imaginaryApi.imageApi}`;
let IMAGINARY_IMAGE_URL = `${Config.imaginaryApi.publicHost}${IMAGINARY_IMAGE}`;

export module utils {
  export class Serializer {
    public static image(image?: IImageModel): any {
      if (image == null)
        return null;

      return {
        id: image.id,
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
        imageUrl: `${IMAGINARY_IMAGE}${image.imaginaryId}`,
        imaginaryId: image.imaginaryIdOriginal,
        cropAreas: Serializer.serializeCropAreas(image.cropAreas),
        status: eImageStatus[image.status],
        comment: image.comment,
        entityId: image.entityId,
        bulkId: image.rails ? image.rails.bulkId : undefined,
      };
    };

    // serialize the images
    public static images(images?: IImageModel[]): IImageModel[] {
      if (images == null) return [];

      return images.map(image => Serializer.image(image));
    };

    public static cropArea(cropArea?: ICropArea): any {
      if (cropArea == null)
        return null;

      return {
        id: cropArea.id,
        x: cropArea.x,
        y: cropArea.y,
        width: cropArea.width,
        height: cropArea.height,
        rotation: cropArea.rotation,
        status: eCropAreaStatus[cropArea.status],
        imaginaryId: cropArea.imaginaryId
      };
    };

    // return an array of objects that can be sent as a queue messages
    public static toQueueObjects(image: IImageModel, cropAreasToInclude: FilteredCropArea[], returnQueueUrl?: string, returnQueue?: eQueues): any[] {
      if (image == null)
        return null;

      let returnArray = [];
      let reportId = image.reportId != null ? image.reportId : undefined;
      let workloadId = (image.requestMetadata && image.requestMetadata.workloadId) || Config.defaultWorkloadId; // backward compatibility
      let companyId = (image.requestMetadata && image.requestMetadata.companyId) || image.entityId; // backward compatibility

      if (image.cropAreas != null && image.cropAreas.length > 0){
        returnArray = cropAreasToInclude.map((filteredCropArea: FilteredCropArea) => {
          return {
            serialized: {
              image: {
                reportId,
                originalImageId: image.imaginaryIdOriginal,
                croppedImageId: filteredCropArea.cropArea.imaginaryId,
                croppedImageNum: filteredCropArea.index + 1,
                croppedImagesTotal: image.cropAreas.length,
              },
              metadata: {
                workloadId,
                transactionId: filteredCropArea.cropArea.queue.transactionId,
                documentId: filteredCropArea.cropArea.id,
                companyId,
                reportId,
                callbackQueue: QueueApi.getQueueObject(returnQueue)
              },
              source: "harvester",
              sourceId: image.id,
              entityId: image.entityId,
              returnQueueUrl: returnQueueUrl,
              imageUrl: `${IMAGINARY_IMAGE_URL}${filteredCropArea.cropArea.imaginaryId}`, // support expedite
              sourceClientUrl: image.clientUrl
            },
            imageId: image.id,
            cropAreaId: filteredCropArea.cropArea.id
          }
        });
      }
      else {
        //rejected: false, a mandatory field for matcher
        returnArray.push({
          serialized: {
            image: {
              reportId,
              originalImageId: image.imaginaryIdOriginal,
              croppedImageNum: 0,
              croppedImagesTotal: 0
            },
            metadata: {
              workloadId,
              transactionId: image.transactionId,
              companyId,
              reportId
            },
            source: "harvester",
            sourceId: image.id,
            rejected: false,
            inScope: false
          },
          imageId: image.id
        });
      }

      return returnArray;
    };

    public static actionVerbToImageStatus(verb: string): eImageStatus {
      if (verb === "reject") return eImageStatus.rejected;

      let status: eImageStatus = eImageStatus[verb];

      if (status == null) Logger.warn(`"${verb}" verb is an illegal image action`);

      return status;
    };

    public static mimeTypeToExt(mimeType: string): string {
      if (mimeType == null || mimeType == "")
        return;

      let returnExtension: string;

      switch(mimeType){
        case "image/jpeg":
          returnExtension = "jpeg";
          break;
        case "image/png":
          returnExtension = "png";
          break;
        case "application/pdf":
          returnExtension = "pdf";
          break;
      }

      return returnExtension;
    };

    private static serializeCropAreas(cropAreas?: ICropArea[]): ICropArea[] {
      if (cropAreas == null || cropAreas.length === 0)
        return [];

      let returnArray: ICropArea[] = cropAreas.map(area => Serializer.cropArea(area));

      return returnArray;
    }
  }
}
