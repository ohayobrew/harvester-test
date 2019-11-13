import BaseTest from '../helpers/tests/base';
import {utils} from './serializer';
import * as mongoose from 'mongoose';
import Serializer = utils.Serializer;
import * as ModelFactory from '../helpers/tests/modelFactory'
import {eImageStatus, ICropArea} from "../models/image/image.model.interface";
import {FilteredCropArea} from "./imageIntegrations";
import {expect} from 'chai';
import * as _ from 'lodash';
import {Factory} from "../helpers/tests/modelFactory";
import {eQueues, QueueApi} from "./queueApi";

//TODO: move to another config structure
import * as path from 'path';
import { DBService } from '../services/dbService';

var configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
let Config = require(configFilePath) || {};

describe('Serializer', () => {

  before((done) => {
    DBService.clearDB().then(done);
  });

  after((done) => {
    DBService.clearDB().then(done);
  });
  
  describe('.toQueueObjects', () => {
    let filterAndTransactionIdHelper = (cropAres: ICropArea[]): FilteredCropArea[]  => {
      let returnArray: FilteredCropArea[] = [];

      cropAres.filter((cropArea, index) => {
        if (cropArea.queue == null || cropArea.queue.messageId == null) {
          cropArea.queue = { transactionId: Factory.newObjectId() };
          returnArray.push({index: index, cropArea: cropArea});

          return true;
        }
        else
          return false;
      });

      return returnArray;
    };


    it('should successfully return an array of objects when crop areas exist', (done) => {
      let imgClone = _.clone(ModelFactory.imageInProgress1);
      let cropAreaClone1 = _.clone(ModelFactory.cropArea1);
      let cropAreaClone2 = _.clone(ModelFactory.cropArea1);

      cropAreaClone1.id = "cropArea1";
      cropAreaClone2.id = "cropArea2";
      cropAreaClone1.imaginaryId = "cropAreaImageId1";
      cropAreaClone2.imaginaryId = "cropAreaImageId2";

      imgClone.id = "serializerTest1";
      imgClone.imaginaryIdOriginal = "originalImaginaryId";
      imgClone.reportId = imgClone.requestMetadata.reportId = "123";
      imgClone.status = eImageStatus.done;
      imgClone.cropAreas = [cropAreaClone1, cropAreaClone2];

      let returnVal = Serializer.toQueueObjects(imgClone, filterAndTransactionIdHelper(imgClone.cropAreas),  "returnQueue", eQueues.matchMergeIn);
      let transactionIdStr1: string = returnVal[0].serialized.metadata.transactionId;
      let transactionIdStr2: string = returnVal[1].serialized.metadata.transactionId;

      expect(returnVal).to.exist;
      expect(returnVal.length).to.equal(2);
      expect(returnVal[0].serialized.source).to.equal("harvester");
      expect(returnVal[0].serialized.sourceId).to.equal(imgClone.id);
      expect(returnVal[0].serialized.sourceClientUrl).to.exist.and.equal(imgClone.clientUrl);
      expect(returnVal[0].serialized.image.reportId).to.exist.and.equal(imgClone.reportId);
      expect(returnVal[0].serialized.entityId).to.exist.and.equal(imgClone.entityId);
      expect(returnVal[0].serialized.metadata.workloadId).to.exist.and.equal(imgClone.requestMetadata.workloadId);
      expect(transactionIdStr1).to.exist.and.not.equal(transactionIdStr2);
      expect(returnVal[0].serialized.metadata.transactionId).to.exist.and.equal(transactionIdStr1);
      expect(returnVal[0].serialized.metadata.companyId).to.exist.and.equal(imgClone.entityId);
      expect(returnVal[0].serialized.metadata.companyId).to.exist.and.equal(imgClone.requestMetadata.companyId);
      expect(returnVal[0].serialized.metadata.reportId).to.exist.and.equal(imgClone.reportId);
      expect(returnVal[0].serialized.metadata.reportId).to.exist.and.equal(imgClone.requestMetadata.reportId);
      expect(returnVal[0].serialized.metadata.documentId).to.exist.and.equal(returnVal[0].cropAreaId);
      expect(returnVal[0].serialized.metadata.callbackQueue).to.exist.and.deep.equal(QueueApi.getQueueObject(eQueues.matchMergeIn));
      expect(returnVal[0].serialized.image.originalImageId).to.exist.and.equal(imgClone.imaginaryIdOriginal);
      expect(returnVal[0].serialized.image.croppedImageId).to.exist.and.equal(cropAreaClone1.imaginaryId);
      expect(returnVal[0].serialized.image.croppedImageNum).to.exist.and.equal(1);
      expect(returnVal[1].serialized.image.croppedImageNum).to.exist.and.equal(2);
      expect(returnVal[0].serialized.image.croppedImagesTotal).to.exist.and.equal(2);
      expect(returnVal[0].serialized.imageUrl).to.exist;
      expect(returnVal[0].serialized.returnQueueUrl).to.exist.and.equal("returnQueue");

      // checking duplicate properties to equal - should be removed in future
      expect(imgClone.requestMetadata.companyId).to.exist.and.equal(imgClone.entityId);
      expect(imgClone.requestMetadata.reportId).to.exist.and.equal(imgClone.reportId);

      done();
    });

    it('should successfully return an array of objects when crop areas are exist and "requestMetadata" does not exist (backward compatibility)', (done) => {
      let imgClone = _.clone(ModelFactory.imageInProgress1);
      let cropAreaClone1 = _.clone(ModelFactory.cropArea1);
      let cropAreaClone2 = _.clone(ModelFactory.cropArea1);

      delete imgClone.requestMetadata;

      cropAreaClone1.id = "cropArea1";
      cropAreaClone2.id = "cropArea2";
      cropAreaClone1.imaginaryId = "cropAreaImageId1";

      cropAreaClone2.imaginaryId = "cropAreaImageId2";
      imgClone.id = "serializerTest1";
      imgClone.imaginaryIdOriginal = "originalImaginaryId";
      imgClone.status = eImageStatus.done;
      imgClone.cropAreas = [cropAreaClone1, cropAreaClone2];

      let returnVal = Serializer.toQueueObjects(imgClone, filterAndTransactionIdHelper(imgClone.cropAreas),  "returnQueue", eQueues.matchMergeIn);
      let transactionIdStr1: string = returnVal[0].serialized.metadata.transactionId;
      let transactionIdStr2: string = returnVal[1].serialized.metadata.transactionId;

      expect(returnVal).to.exist;
      expect(returnVal.length).to.equal(2);
      expect(returnVal[0].serialized.source).to.equal("harvester");
      expect(returnVal[0].serialized.sourceId).to.equal(imgClone.id);
      expect(returnVal[0].serialized.sourceClientUrl).to.exist.and.equal(imgClone.clientUrl);
      expect(returnVal[0].serialized.image.reportId).to.exist.and.equal(imgClone.reportId);
      expect(returnVal[0].serialized.entityId).to.exist.and.equal(imgClone.entityId);
      expect(returnVal[0].serialized.metadata.workloadId).to.exist.and.equal(Config.defaultWorkloadId);
      expect(transactionIdStr1).to.exist.and.not.equal(transactionIdStr2);
      expect(returnVal[0].serialized.metadata.transactionId).to.exist.and.equal(transactionIdStr1);
      expect(returnVal[0].serialized.metadata.companyId).to.exist.and.equal(imgClone.entityId);
      expect(returnVal[0].serialized.metadata.reportId).to.exist.and.equal(imgClone.reportId);
      expect(returnVal[0].serialized.metadata.documentId).to.exist.and.equal(returnVal[0].cropAreaId);
      expect(returnVal[0].serialized.metadata.callbackQueue).to.exist.and.deep.equal(QueueApi.getQueueObject(eQueues.matchMergeIn));
      expect(returnVal[0].serialized.image.originalImageId).to.exist.and.equal(imgClone.imaginaryIdOriginal);
      expect(returnVal[0].serialized.image.croppedImageId).to.exist.and.equal(cropAreaClone1.imaginaryId);
      expect(returnVal[0].serialized.image.croppedImageNum).to.exist.and.equal(1);
      expect(returnVal[1].serialized.image.croppedImageNum).to.exist.and.equal(2);
      expect(returnVal[0].serialized.image.croppedImagesTotal).to.exist.and.equal(2);
      expect(returnVal[0].serialized.imageUrl).to.exist;
      expect(returnVal[0].serialized.returnQueueUrl).to.exist.and.equal("returnQueue");

      done();
    });

    it('should successfully return an array of objects when crop areas are exist and image.reportId property does not exist', (done) => {
      let imgClone = _.clone(ModelFactory.imageInProgress1);
      let cropAreaClone1 = _.clone(ModelFactory.cropArea1);
      let cropAreaClone2 = _.clone(ModelFactory.cropArea1);

      cropAreaClone1.id = "cropArea1";
      cropAreaClone2.id = "cropArea2";
      cropAreaClone1.imaginaryId = "cropAreaImageId1";
      cropAreaClone2.imaginaryId = "cropAreaImageId2";

      imgClone.id = "serializerTest1";
      imgClone.imaginaryIdOriginal = "originalImaginaryId";
      imgClone.reportId = imgClone.requestMetadata.reportId = undefined;
      imgClone.status = eImageStatus.done;
      imgClone.cropAreas = [cropAreaClone1, cropAreaClone2];

      let returnVal = Serializer.toQueueObjects(imgClone, filterAndTransactionIdHelper(imgClone.cropAreas), "returnQueue");
      let transactionIdStr: string = (new mongoose.Types.ObjectId(returnVal[0].serialized.metadata.transactionId)).toString();

      expect(returnVal).to.exist;
      expect(returnVal.length).to.equal(2);
      expect(returnVal[0].serialized.source).to.equal("harvester");
      expect(returnVal[0].serialized.sourceId).to.equal(imgClone.id);
      expect(returnVal[0].serialized.image.reportId).to.not.exist;
      expect(returnVal[0].serialized.entityId).to.exist.and.equal(imgClone.entityId);
      expect(returnVal[0].serialized.metadata.workloadId).to.exist.and.equal(imgClone.requestMetadata.workloadId);
      expect(returnVal[0].serialized.metadata.transactionId).to.exist.and.equal(transactionIdStr);
      expect(returnVal[0].serialized.metadata.companyId).to.exist.and.equal(imgClone.entityId);
      expect(returnVal[0].serialized.metadata.companyId).to.exist.and.equal(imgClone.requestMetadata.companyId);
      expect(returnVal[0].serialized.metadata.reportId).to.not.exist;
      expect(returnVal[0].serialized.image.originalImageId).to.exist.and.equal(imgClone.imaginaryIdOriginal);
      expect(returnVal[0].serialized.image.croppedImageId).to.exist.and.equal(cropAreaClone1.imaginaryId);
      expect(returnVal[0].serialized.image.croppedImageNum).to.exist.and.equal(1);
      expect(returnVal[1].serialized.image.croppedImageNum).to.exist.and.equal(2);
      expect(returnVal[0].serialized.image.croppedImagesTotal).to.exist.and.equal(2);
      expect(returnVal[0].serialized.imageUrl).to.exist;
      expect(returnVal[0].serialized.returnQueueUrl).to.exist.and.equal("returnQueue");

      // checking duplicate properties to equal - should be removed in future
      expect(imgClone.requestMetadata.companyId).to.exist.and.equal(imgClone.entityId);
      expect(imgClone.requestMetadata.reportId).to.equal(imgClone.reportId);

      done();
    });

    it('should successfully return an array with one cropArea that still did not sent', (done) => {
      let imgClone = _.clone(ModelFactory.imageInProgress1);
      let cropAreaClone1 = _.clone(ModelFactory.cropArea1);

      cropAreaClone1.id = "cropArea1";
      cropAreaClone1.imaginaryId = "cropAreaImageId1";

      let cropAreaClone2 = _.clone(cropAreaClone1);

      cropAreaClone1.queue = {messageId: "messageId", enqueuedAt: new Date()};

      imgClone.id = "serializerTest1";
      imgClone.imaginaryIdOriginal = "originalImaginaryId";
      imgClone.reportId = undefined;
      imgClone.status = eImageStatus.done;
      imgClone.cropAreas = [cropAreaClone1, cropAreaClone2];

      let returnVal = Serializer.toQueueObjects(imgClone, filterAndTransactionIdHelper(imgClone.cropAreas), "returnQueue");

      expect(returnVal).to.exist;
      expect(returnVal.length).to.equal(1);
      expect(returnVal[0].serialized.source).to.equal("harvester");
      expect(returnVal[0].serialized.sourceId).to.equal(imgClone.id);
      expect(returnVal[0].serialized.image.reportId).to.not.exist;
      expect(returnVal[0].serialized.entityId).to.exist.and.equal(imgClone.entityId);
      expect(returnVal[0].serialized.image.originalImageId).to.exist.and.equal(imgClone.imaginaryIdOriginal);
      expect(returnVal[0].serialized.image.croppedImageId).to.exist.and.equal(cropAreaClone1.imaginaryId);
      // one was skipped, so index of serialized image should be 2
      expect(returnVal[0].serialized.image.croppedImageNum).to.exist.and.equal(2);
      expect(returnVal[0].serialized.image.croppedImagesTotal).to.exist.and.equal(2);
      expect(returnVal[0].serialized.imageUrl).to.exist;
      expect(returnVal[0].serialized.returnQueueUrl).to.exist.and.equal("returnQueue");

      done();
    });

    it('should successfully return an empty array when all crop areas already sent', (done) => {
      let imgClone = _.clone(ModelFactory.imageInProgress1);
      let cropAreaClone = _.clone(ModelFactory.cropArea1);

      cropAreaClone.id = "cropArea1";
      cropAreaClone.imaginaryId = "cropAreaImageId1";
      cropAreaClone.queue = {messageId: "messageId", enqueuedAt: new Date()};

      imgClone.id = "serializerTest1";
      imgClone.imaginaryIdOriginal = "originalImaginaryId";
      imgClone.requestMetadata = undefined;
      imgClone.status = eImageStatus.done;
      imgClone.cropAreas = [cropAreaClone, cropAreaClone];

      let returnVal = Serializer.toQueueObjects(imgClone, filterAndTransactionIdHelper(imgClone.cropAreas), "returnQueue");

      expect(returnVal).to.exist;
      expect(returnVal.length).to.equal(0);

      done();
    });

    it('should return one object with indication about no crop areas, when there are no crop areas', (done) => {
      let imgClone = _.clone(ModelFactory.imageInProgress1);

      imgClone.id = "serializerTest1";
      imgClone.imaginaryIdOriginal = "originalImaginaryId";
      imgClone.reportId = imgClone.requestMetadata.reportId ="123";
      imgClone.status = eImageStatus.done;
      imgClone.transactionId = Factory.newObjectId();

      let returnVal = Serializer.toQueueObjects(imgClone, [], "returnQueue");

      expect(returnVal).to.exist;
      expect(returnVal.length).to.equal(1);
      expect(returnVal[0].serialized.source).to.equal("harvester");
      expect(returnVal[0].serialized.sourceId).to.equal(imgClone.id);
      expect(returnVal[0].serialized.image.reportId).to.exist.and.equal(imgClone.reportId);
      expect(returnVal[0].serialized.sourceClientUrl).to.not.exist;
      expect(returnVal[0].serialized.entityId).to.not.exist;
      expect(returnVal[0].serialized.rejected).to.exist.and.be.false;
      expect(returnVal[0].serialized.inScope).to.exist.and.be.false;
      expect(returnVal[0].serialized.metadata.workloadId).to.exist.and.equal(imgClone.requestMetadata.workloadId);
      expect(returnVal[0].serialized.metadata.transactionId).to.exist.and.equal(imgClone.transactionId);
      expect(returnVal[0].serialized.metadata.companyId).to.exist.and.equal(imgClone.entityId);
      expect(returnVal[0].serialized.metadata.companyId).to.exist.and.equal(imgClone.requestMetadata.companyId);
      expect(returnVal[0].serialized.metadata.reportId).to.exist.and.equal(imgClone.reportId);
      expect(returnVal[0].serialized.metadata.reportId).to.exist.and.equal(imgClone.requestMetadata.reportId);
      expect(returnVal[0].serialized.metadata.documentId).to.not.exist;
      expect(returnVal[0].serialized.image.originalImageId).to.exist.and.equal(imgClone.imaginaryIdOriginal);
      expect(returnVal[0].serialized.image.croppedImageId).to.not.exist;
      expect(returnVal[0].serialized.image.croppedImageNum).to.exist.and.equal(0);
      expect(returnVal[0].serialized.image.croppedImageUrl).to.not.exist;
      expect(returnVal[0].serialized.image.croppedImagesTotal).to.exist.and.equal(0);
      expect(returnVal[0].serialized.imageUrl).to.not.exist;
      expect(returnVal[0].serialized.returnQueueUrl).to.not.exist;

      done();
    });

    it('should return one object with indication about no crop areas, when there are no crop areas and "requestMetadata" does not exist (backward compatibility)', (done) => {
      let imgClone = _.clone(ModelFactory.imageInProgress1);

      delete imgClone.requestMetadata;

      imgClone.id = "serializerTest1";
      imgClone.imaginaryIdOriginal = "originalImaginaryId";
      imgClone.status = eImageStatus.done;
      imgClone.transactionId = Factory.newObjectId();

      let returnVal = Serializer.toQueueObjects(imgClone, [], "returnQueue");

      expect(returnVal).to.exist;
      expect(returnVal.length).to.equal(1);
      expect(returnVal[0].serialized.source).to.equal("harvester");
      expect(returnVal[0].serialized.sourceId).to.equal(imgClone.id);
      expect(returnVal[0].serialized.image.reportId).to.exist.and.equal(imgClone.reportId);
      expect(returnVal[0].serialized.sourceClientUrl).to.not.exist;
      expect(returnVal[0].serialized.entityId).to.not.exist;
      expect(returnVal[0].serialized.rejected).to.exist.and.be.false;
      expect(returnVal[0].serialized.metadata.workloadId).to.exist.and.equal(Config.defaultWorkloadId);
      expect(returnVal[0].serialized.metadata.transactionId).to.exist.and.equal(imgClone.transactionId);
      expect(returnVal[0].serialized.metadata.companyId).to.exist.and.equal(imgClone.entityId);
      expect(returnVal[0].serialized.metadata.reportId).to.exist.and.equal(imgClone.reportId);
      expect(returnVal[0].serialized.metadata.documentId).to.not.exist;
      expect(returnVal[0].serialized.image.originalImageId).to.exist.and.equal(imgClone.imaginaryIdOriginal);
      expect(returnVal[0].serialized.image.croppedImageId).to.not.exist;
      expect(returnVal[0].serialized.image.croppedImageNum).to.exist.and.equal(0);
      expect(returnVal[0].serialized.image.croppedImageUrl).to.not.exist;
      expect(returnVal[0].serialized.image.croppedImagesTotal).to.exist.and.equal(0);
      expect(returnVal[0].serialized.imageUrl).to.not.exist;
      expect(returnVal[0].serialized.returnQueueUrl).to.not.exist;

      done();
    });

    it('should return null if image is null', (done) => {
      let returnVal = Serializer.toQueueObjects(null, []);

      expect(returnVal).to.be.null;

      done();
    });
  });

  describe('.mimeTypeToExt', () => {
    it('should successfully return jpeg for "image/jpeg"', () => {
      let returnVal = Serializer.mimeTypeToExt("image/jpeg");

      expect(returnVal).to.exist;
      expect(returnVal).to.equal("jpeg");
    });

    it('should successfully return png for "image/png"', () => {
      let returnVal = Serializer.mimeTypeToExt("image/png");

      expect(returnVal).to.exist;
      expect(returnVal).to.equal("png");
    });

    it('should successfully return png for "application/pdf"', () => {
      let returnVal = Serializer.mimeTypeToExt("application/pdf");

      expect(returnVal).to.exist;
      expect(returnVal).to.equal("pdf");
    });

    it('should return undefined for not supported value"', () => {
      let returnVal = Serializer.mimeTypeToExt("app/pdf");

      expect(returnVal).to.not.exist;
    });

    it('should return undefined for null"', () => {
      let returnVal = Serializer.mimeTypeToExt(null);

      expect(returnVal).to.not.exist;
    });

  });

});

