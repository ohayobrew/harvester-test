import { ConfigService } from './../../services/configService';
import {IImageModel} from "../../models/image/image.model.interface";
import {IUserModel} from "../../models/user/user.model.interface";
import {ICropArea} from "../../models/image/image.model.interface";
import {eImageStatus} from "../../models/image/image.model.interface";
import {eCropAreaStatus} from "../../models/image/image.model.interface";
import {utils} from '../../utils/serializer';
import * as mongoose from 'mongoose';
import * as _ from 'lodash';
import {eImageTask} from '../../models/image/image.model.interface'

let dayBeforeNow: Date = new Date((new Date()).setDate((new Date()).getDate()-1));

/**************
* ObjectIds
***************/

export let objectId1 = "56b9eee67cb3d1195b49ae3e";
export let objectId2 = "56b9ecc5e4983ec45a8067ac";

/**************
* IMAGES
***************/

export let imageBasicModel1: IImageModel = {
  createdAt: dayBeforeNow,
  status: eImageStatus.inProgress,
  entityId: "imageBasicModel1_entityId",
  imaginaryId: "imageBasicModel1_imaginaryId",
  source: "test"
};

export let imageInProgress1: IImageModel = {
  cloudinary: {
    publicId: "publicId1"
  },
  createdAt: dayBeforeNow,
  clientUrl: "dummyClientUrl",
  tags: ["outsource"],
  comment: "imageInProgress1",
  status: eImageStatus.inProgress,
  entityId: "3333",
  imaginaryId: "3333",
  source: "test",
  reportId: "reportId1",
  requestMetadata: {
    workloadId: "workloadId1",
    reportId: "reportId1",
    transactionId: "transactionId1",
    companyId: "3333",
    version: "v1"
  }
};

export let imageInProgressWithoutEntityId: IImageModel = {
  cloudinary: {
    publicId: "publicId2"
  },
  createdAt: new Date(),
  tags: ["outsource"],
  comment: "imageInProgress2",
  status: eImageStatus.inProgress
};

export let imageInProgressA: IImageModel = {
  cloudinary: {
    publicId: "publicIdA"
  },
  createdAt: new Date(),
  tags: ["inhouse"],
  comment: "imageInProgressA",
  status: eImageStatus.inProgress,
  entityId: "imageInProgressA"
};

export let imageInProgressWithCropAreas: IImageModel = {
  cloudinary: {
    publicId: "publicIdA"
  },
  createdAt: new Date(),
  tags: ["inhouse"],
  comment: "imageInProgressA",
  status: eImageStatus.inProgress,
  entityId: "imageInProgressA",
  cropAreas: [{
    createdAt: new Date(),
    imaginaryId: "imaginaryIdOriginal"
  }]
};

export let imageNeedImaginaryConversion: IImageModel = {
  createdAt: dayBeforeNow,
  comment: "imageNeedImaginaryConversion",
  status: eImageStatus.waitingTask,
  entityId: "3333",
  imaginaryId: "3333",
  source: "test"
};

export let imageInProgressWithoutTags: IImageModel = {
  cloudinary: {
    publicId: "publicId1111"
  },
  createdAt: new Date(),
  comment: "imageInProgressWithoutTags",
  status: eImageStatus.inProgress,
  entityId: "imageInProgressWithoutTags"
};

export let imageInProgressWithoutTagsWithCropAreas: IImageModel = {
  cloudinary: {
    publicId: "publicId1111"
  },
  createdAt: new Date(),
  comment: "imageInProgressWithoutTags",
  status: eImageStatus.inProgress,
  entityId: "imageInProgressWithoutTags",
  cropAreas: [{
    createdAt: new Date(),
    imaginaryId: "imaginaryIdOriginal"
  }]
};

export let imageDoneWithoutTags: IImageModel = {
  cloudinary: {
    publicId: "publicId9876"
  },
  createdAt: new Date(),
  comment: "imageDoneWithoutTags",
  status: eImageStatus.done,
  entityId: "imageDoneWithoutTags"
};

export let imageRejectedWithoutTags: IImageModel = {
  cloudinary: {
    publicId: "publicId54321"
  },
  createdAt: new Date(),
  comment: "imageRejectedWithoutTags",
  status: eImageStatus.rejected,
  entityId: "4444"
};

export let imageRejectedWithoutTagsWithCropAreas: IImageModel = {
  cloudinary: {
    publicId: "publicId54321"
  },
  createdAt: new Date(),
  comment: "imageRejectedWithoutTags",
  status: eImageStatus.rejected,
  entityId: "4444",
  cropAreas: [{
    createdAt: new Date(),
    imaginaryId: "imaginaryIdOriginal"
  }]
};

export let imagePDFWithMultiPages: IImageModel = {
  createdAt: new Date(),
  comment: "imageRejectedWithoutTags",
  status: eImageStatus.waitingTask,
  entityId: "4444",
  cropAreas: [{
    createdAt: new Date(),
    imaginaryId: "imaginaryIdOriginal"
  }],
  nextTask: {
    task: eImageTask.multipageConversion
  }
};

export let imageFailedCreatingAllInvoicesWithoutTags: IImageModel = {
  cloudinary: {
    publicId: "publicId2222"
  },
  createdAt: new Date(),
  comment: "imageFailedCreatingAllInvoicesWithoutTags",
  status: eImageStatus.failedCreatingAllInvoices
};

export let imageCreatingInvoicesWithoutTags: IImageModel = {
  cloudinary: {
    publicId: "publicId7777"
  },
  createdAt: new Date(),
  comment: "imageCreatingInvoicesWithoutTags",
  clientUrl: "clientUrl777",
  status: eImageStatus.creatingInvoices
};

export let imageStatusErrorWithMaxRetries: IImageModel = {
  createdAt: dayBeforeNow,
  comment: "imageNeedImaginaryConversion",
  status: eImageStatus.error,
  entityId: "3333",
  imaginaryId: "3333",
  source: "test",
  updatedAt: dayBeforeNow,
  nextTask: {
    retries: ConfigService.getConfig('tasks').maxRetries
  }
};

export let imageWithoutStatus: IImageModel = {
  createdAt: dayBeforeNow,
  comment: "imageNeedImaginaryConversion",
  entityId: "3333",
  imaginaryId: "3333",
  source: "test",
  updatedAt: dayBeforeNow,
  nextTask: {
    
  }
};
 
const createValue = _.cloneDeep(imageInProgress1);

export let legalMessageBody = {
  metadata: {
    workloadId: createValue.requestMetadata.workloadId,
    reportId: createValue.requestMetadata.reportId,
    companyId: createValue.requestMetadata.companyId,
    transactionId: createValue.requestMetadata.transactionId
  },
  data: {
    imageId: createValue.imaginaryId, // imaginaryId is the property name in db,
    entityId: createValue.entityId,
    tags: createValue.tags,
    source: createValue.source,
    reportId: createValue.reportId,
    reCalc: undefined
  }
};

/**************
 * CROP AREA
 ***************/

export let cropArea1: ICropArea = {
  id: "",
  createdByUserId: "",
  createdAt: new Date(),
  cloudinary: {
    publicId: "CropArea1",
    version: "v123",
    format: "png",
  },
  x: 100,
  y: 100,
  width: 100,
  height: 100,
  rotation: 90,
  status: eCropAreaStatus.fresh
};

export let cropAreaInvoiceCreated1: ICropArea = {
  id: "",
  createdByUserId: "",
  createdAt: new Date(),
  cloudinary: {
    publicId: "cropAreaInvoiceCreated1",
    version: "v123",
    format: "png",
  },
  x: 100,
  y: 100,
  width: 100,
  height: 100,
  rotation: 90,
  status: eCropAreaStatus.invoiceCreated,
  invoiceId: "cropAreaInvoiceCreated1"
};

export let cropAreaRequestBody1: any = utils.Serializer.cropArea(cropArea1);

/**************
 * USERS
 ***************/

export let  userWithoutTags: IUserModel = {
  id: "userWithoutTagsId",
  email: "user@vatbox.com",
  vatboxUserId: "userWithoutTags",
  tags: []
};

  export let userWithInhouseTag: IUserModel = {
  vatboxUserId: "userWithOneTag",
  tags: ["inhouse"]
};

export let userWithMultipleTags: IUserModel = {
  vatboxUserId: "userWithMultipleTags",
  tags: ["inhouse", "outsoucre"]
};


export class Factory {

  // will clone base image and override properties as demand
  static generateImage(baseImage: IImageModel, overrideProperties?: IImageModel, deleteProperties?: string[]): IImageModel {
    let imageClone = _.cloneDeep(baseImage);

    if (deleteProperties) {
      deleteProperties.forEach((property) => {
        delete imageClone[property];
      })
    }

    if (overrideProperties)
      imageClone = {...imageClone, ...overrideProperties}

    return Factory.randomizeTransactionId(imageClone);
  }

  static generateImageWithCropAreas(baseImage: IImageModel, baseCropArea: ICropArea, totalCropAreas: number, withImaginaryCropAreas: number, overrideProperties?: IImageModel, deleteProperties?: string[]): IImageModel {
    let image = Factory.generateImage(baseImage, overrideProperties, deleteProperties);
    let cropAreasCreatedCounter = 0;

    image.cropAreas = [];

    for (let i = 0; i < totalCropAreas; i++) {
      let cropArea = _.cloneDeep(baseCropArea);

      // create
      if (cropAreasCreatedCounter < withImaginaryCropAreas){
        cropArea.imaginaryId = Factory.newObjectId();
      }
      else {
        delete cropArea.imaginaryId;
        delete cropArea.cloudinary;
      }

      image.cropAreas.push(cropArea);

      cropAreasCreatedCounter++;
    }

    return Factory.randomizeTransactionId(image);
  }

  static newObjectId(): string {
    let objectId = mongoose.Types.ObjectId;
    let now: number = (new Date()).getTime();

    return (new objectId(now)).toString();
  }

  static subtractMinutesFromNowToDate(minutes: number): Date {
    let now = new Date();
    return new Date((now.setMinutes(now.getMinutes() - minutes)));
  };

  static randomizeTransactionId(image) {
    let newImage = _.cloneDeep(image);

    if (newImage.requestMetadata && newImage.requestMetadata.transactionId) {
      newImage.requestMetadata.transactionId += Math.random().toString();
    }
      
    return newImage;
  }
}
