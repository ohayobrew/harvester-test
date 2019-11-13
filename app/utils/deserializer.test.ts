import BaseTest from '../helpers/tests/base';
import {Deserializer} from './deserializer';
import {expect} from 'chai';
import * as _ from 'lodash';

//TODO: move to another config structure
import * as path from 'path';
import {IEntityPriority} from "../models/config/config.model.interface";
import {eImageTask, eImageStatus} from "../models/image/image.model.interface";
var configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
let Config = require(configFilePath) || {};

describe('Deserializer', () => {
  let self = this;

  describe('.fromMessageBody', () => {
    let legalMessage = {
      metadata: {
        workloadId: "workloadId",
        reportId: "reportId",
        companyId: "entityId",
        transactionId: "transactionId",
        version: "v1"
      },
      data: {
        imageId: "imageId",
        entityId: "entityId",
        tags: ["tag1", "tag2"],
        source: "source",
        reportId: "reportId"
      }
    };

    it('should successfully return an object when message is legal and all required fields exist', (done) => {
      let msgClone = _.clone(legalMessage);

      let returnVal = Deserializer.fromMessageBody(JSON.stringify(msgClone));

      expect(returnVal).to.exist;
      expect(returnVal.imageId).to.equal(msgClone.data.imageId);
      expect(returnVal.entityId).to.equal(msgClone.data.entityId);
      expect(returnVal.tags).to.deep.equal(msgClone.data.tags);
      expect(returnVal.source).to.equal(msgClone.data.source);
      expect(returnVal.reportId).to.equal(msgClone.data.reportId);
      expect(returnVal.metadata).to.deep.equal(msgClone.metadata);

      done();
    });

    it('should return null when mandatory field is missing', (done) => {
      // in "data"
      ["imageId", "entityId", "source"].forEach((key) => {
        let msgClone = _.clone(legalMessage);
        msgClone.data[key] = undefined;

        let returnVal = Deserializer.fromMessageBody(JSON.stringify(msgClone));

        expect(returnVal).to.be.null;
      });

      // in "metadata"
      ["workloadId", "reportId", "transactionId"].forEach((key) => {
        let msgClone = _.clone(legalMessage);
        msgClone.metadata[key] = undefined;

        let returnVal = Deserializer.fromMessageBody(JSON.stringify(msgClone));

        expect(returnVal).to.be.null;
      });

      done();
    });

    it('should return null when message is null', (done) => {
      let returnVal = Deserializer.fromMessageBody(null);

      expect(returnVal).to.be.null;
      done();
    })

    it('should return null when JSON.parse is raising exception', (done) => {
      let returnVal = Deserializer.fromMessageBody("blabla[]'");

      expect(returnVal).to.be.null;
      done();
    })
  });

  describe('.skipCrop', () => {
    let image = {
      imaginaryIdOriginal: "imaginaryId"
    };

    it('should return a modified image model for skip cropping case', () => {
      let skipCropImage = Deserializer.skipCrop(image);

      expect(skipCropImage).to.exist;
      expect(skipCropImage).to.not.equal(image);
      expect(skipCropImage.status).to.equal(eImageStatus.waitingTask);
      expect(skipCropImage.skippedCrop).to.equal(true);
      expect(skipCropImage.cropAreas).to.exist;
      expect(skipCropImage.cropAreas.length).to.equal(1);
      expect(skipCropImage.cropAreas[0].imaginaryId).to.equal(image.imaginaryIdOriginal);
      expect(skipCropImage.nextTask).to.exist;
      expect(skipCropImage.nextTask.task).to.exist.and.equal(eImageTask.processComplete);
    });
  });

  describe('.entityPriorities', () => {
    it('should successfully return an object when message is legal and all required fields exist', (done) => {
      let returnVal: IEntityPriority[] = Deserializer.entityPriorities(["entity1", "entity2", "entity3", "entity4"]);

      expect(returnVal).to.exist;
      expect(returnVal.length).to.equal(4);
      expect(returnVal[0].entityId).to.equal("entity1");
      expect(returnVal[0].priority).to.equal(4);
      expect(returnVal[0].consider).to.equal(true);

      expect(returnVal[3].entityId).to.equal("entity4");
      expect(returnVal[3].priority).to.equal(1);
      expect(returnVal[3].consider).to.equal(true);

      done();
    });

    it('should return empty array when parameter is an empty array', (done) => {
      let returnVal = Deserializer.entityPriorities([]);

      expect(returnVal).to.exist;
      expect(returnVal.length).to.equal(0);

      done();
    });

    it('should return undefined when parameter is null/undefined', (done) => {
      let returnVal = Deserializer.entityPriorities(null);

      expect(returnVal).to.not.exist;

      returnVal = Deserializer.entityPriorities(undefined);

      expect(returnVal).to.not.exist;

      done();
    });

    it('should return undefined when parameter is not an array', (done) => {
      let parameter: any = {};
      let returnVal = Deserializer.entityPriorities(parameter);

      expect(returnVal).to.not.exist;

      done();
    });

    it('should return empty when parameter is an array of non strings', (done) => {
      let parameter: any = [{k: "v"}];
      let returnVal = Deserializer.entityPriorities(parameter);

      expect(returnVal).to.exist;
      expect(returnVal.length).to.equal(0);

      done();
    });
  });

});

