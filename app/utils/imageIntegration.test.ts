import * as sinon from 'sinon';
import ImageIntegrations from './imageIntegrations';
import {ImaginaryService} from '../services/imaginaryService';
import {QueueApi} from './queueApi';
import ImageModel from '../models/image/image.model';
import UserModel from '../models/user/user.model';
import * as ModelFactory from '../helpers/tests/modelFactory'
import {eImageStatus, IImageModel} from '../models/image/image.model.interface';
import * as _ from 'lodash';
import {Factory} from "../helpers/tests/modelFactory";
import ImageService from "../api/v1.0/image/service/imageService";
import {utils} from './serializer';
import Serializer = utils.Serializer; 

import { DBService } from '../services/dbService';
import { Deserializer } from './deserializer';
import { PreProcessService } from '../services/preProcessService';

var expect = require('chai').expect;

describe('Image Integrations', () => {
  var self = this
  self._updateImageActiveUser = (imageToUpdate: IImageModel, updatedAt: Date, createdAt: Date, userId: string) => {
    return new Promise( (resolve, reject) => {
      ImageModel.mongoose.findOne({_id: imageToUpdate.id}).exec()
      .then((image) => {
        image.updatedAt = updatedAt;
        image.createdAt = createdAt;
        image.activeUser = userId;
        image.save( (err) => {
          if (err) {
            reject(err)
            return
          }
  
          resolve(new ImageModel(image))
        });
      })
      .catch(err => reject(err))
    })
  }

  describe('.createCropImages', () => {
    var self = this;

    beforeEach((done) => {
      self.createCropImageStub = sinon.stub(ImaginaryService, "createCropImage").callsFake(() => { return Promise.resolve(self.imaginaryResponse)});
      self.setCropAreaImageStub = sinon.stub(ImageModel, "setCropAreaImage").callsFake(() => { return Promise.resolve(true)});
      done();
    });

    afterEach((done) => {
      self.createCropImageStub.restore();
      self.setCropAreaImageStub.restore();
      done();
    });

    it('should call stubs as the amount of image crop areas', (done) => {
      const image = {cropAreas: [ModelFactory.cropArea1, ModelFactory.cropArea1]};
      self.imaginaryResponse = {id: "123", cloudinaryId: "publicId123", mimeType: "jpeg"};

      ImageIntegrations.createCropImages(image)
        .then((returnVal) => {
          expect(self.createCropImageStub.callCount).to.equal(image.cropAreas.length);
          expect(self.setCropAreaImageStub.callCount).to.equal(image.cropAreas.length);
          done();
        })
        .catch(done);
    })

    it('should call stubs as the amount of image crop areas event if there is not active user on image', (done) => {
      const cropArea = Object.assign(ModelFactory.cropArea1, {createdByUserId: null})
      const image = {cropAreas: [cropArea, cropArea]};
      self.imaginaryResponse = {id: "123", cloudinaryId: "publicId123", mimeType: "jpeg"};

      ImageIntegrations.createCropImages(image)
        .then((returnVal) => {
          expect(self.createCropImageStub.callCount).to.equal(image.cropAreas.length);
          expect(self.setCropAreaImageStub.callCount).to.equal(image.cropAreas.length);
          done();
        })
        .catch(done);
    });

    it('should reject if one of the calls to ImaginaryService.createCropImage() was rejected', (done) => {
      let totalResolve: number = 1;
      let resolveCount: number = 0;
      let rejectCount: number = 0;

      const image = {cropAreas: [ModelFactory.cropArea1, ModelFactory.cropArea1, ModelFactory.cropArea1]};
      self.imaginaryResponse = {id: "123", cloudinaryId: "publicId123", mimeType: "jpeg"};

      self.createCropImageStub.restore();
      // will resolve one and reject other two
      self.createCropImageStub = sinon.stub(ImaginaryService, "createCropImage").callsFake(() => {
        if (resolveCount < totalResolve){
          resolveCount++;
          return Promise.resolve(self.imaginaryResponse);
        }
        else{
          rejectCount++;
          return Promise.reject(`ERROR ${rejectCount}`);
        }
      });

      // Promise.all should reject with the error of the first reject occurred
      ImageIntegrations.createCropImages(image)
        .catch((returnVal) => {
          expect(self.createCropImageStub.callCount).to.equal(image.cropAreas.length);
          expect(self.setCropAreaImageStub.callCount).to.equal(totalResolve);
          done();
        })
        .catch(done);
    })

    it('should return empty array if image has no cropAreas', (done) => {
      const image = {cropAreas: []};
      self.imaginaryResponse = {id: "123", cloudinaryId: "publicId123", mimeType: "jpeg"};

      ImageIntegrations.createCropImages(image)
        .then((returnVal) => {
          expect(self.createCropImageStub.callCount).to.equal(image.cropAreas.length);
          expect(self.setCropAreaImageStub.callCount).to.equal(image.cropAreas.length);
          done();
        })
        .catch(done);
    });

    it('should reject if failed creating images', (done) => {
      const image = {cropAreas: [ModelFactory.cropArea1, ModelFactory.cropArea1]};
      self.createCropImageStub.restore();
      self.createCropImageStub = sinon.stub(ImaginaryService, "createCropImage").callsFake(() => { return Promise.reject("error!")});

      ImageIntegrations.createCropImages(image)
        .catch((returnVal) => {
          expect(self.setCropAreaImageStub.callCount).to.equal(0);
          done();
        })
        .catch(done);
    });
  });

  describe('.createTransactionIds', () => {
    var self = this;

    beforeEach((done) => {
      self.setImageTransactionIdStub = sinon.stub(ImageModel, "setImageTransactionId").callsFake(() => { return Promise.resolve(self.returnImage)});
      self.setCropAreaTransactionIdStub = sinon.stub(ImageModel, "setCropAreaTransactionId").callsFake(() => { return Promise.resolve(self.returnImage)});
      done();
    });

    afterEach((done) => {
      self.setImageTransactionIdStub.restore();
      self.setCropAreaTransactionIdStub.restore();
      done();
    });

    it('should call stubs as the amount of image crop areas without transactionId exists', (done) => {
      let cloneCropArea = _.clone(ModelFactory.cropArea1);

      cloneCropArea.queue = { transactionId: Factory.newObjectId()};

      const image = {cropAreas: [ModelFactory.cropArea1, ModelFactory.cropArea1, cloneCropArea]};

      ImageIntegrations.createTransactionIds(image)
        .then((returnVal) => {
          // one cropArea already have transactionId
          expect(self.setCropAreaTransactionIdStub.callCount).to.equal(image.cropAreas.length - 1);
          expect(self.setImageTransactionIdStub.notCalled).to.equal(true);
          done();
        })
        .catch(done);
    });

    it('should reject if one of the calls to ImageModel.setCropAreaTransactionId() was rejected', (done) => {
      let totalResolve: number = 1;
      let resolveCount: number = 0;
      let rejectCount: number = 0;

      const image = {cropAreas: [ModelFactory.cropArea1, ModelFactory.cropArea1, ModelFactory.cropArea1]};

      self.setCropAreaTransactionIdStub.restore();
      // will resolve one and reject other two
      self.setCropAreaTransactionIdStub = sinon.stub(ImageModel, "setCropAreaTransactionId").callsFake(() => {
        if (resolveCount < totalResolve){
          resolveCount++;
          return Promise.resolve(image);
        }
        else{
          rejectCount++;
          return Promise.reject(`ERROR ${rejectCount}`);
        }
      });

      // Promise.all should reject with the error of the first reject occurred
      ImageIntegrations.createTransactionIds(image)
        .catch((returnVal) => {
          expect(self.setCropAreaTransactionIdStub.callCount).to.equal(image.cropAreas.length);
          expect(self.setImageTransactionIdStub.notCalled).to.equal(true);
          expect(returnVal.length).to.equal(rejectCount);
          done();
        })
        .catch(done);
    })

    it('should resolve and set "transactionId" for image when image have zero cropAreas', (done) => {
      const image = {cropAreas: []};

      ImageIntegrations.createTransactionIds(image)
        .then((returnVal) => {
          expect(self.setCropAreaTransactionIdStub.notCalled).to.equal(true);
          expect(self.setImageTransactionIdStub.calledOnce).to.equal(true);

          done();
        })
        .catch(done);
    });

    it('should resolve and skip .setImageTransactionId() when image have zero cropAreas and do already have transactionId', (done) => {
      const image = {cropAreas: [], transactionId: Factory.newObjectId()};

      ImageIntegrations.createTransactionIds(image)
        .then((returnVal) => {
          expect(self.setCropAreaTransactionIdStub.notCalled).to.equal(true);
          expect(self.setImageTransactionIdStub.notCalled).to.equal(true);

          done();
        })
        .catch(done);
    });
  });

  describe('.sendToPreProcess', () => {
    var self = this;
    
    beforeEach((done) => {
      self.index = 0  

      self.isImageFileStub = sinon.stub(ImaginaryService, 'isImageFile').callsFake(() => Promise.resolve(true));
      self.manipulateImageStub = sinon.stub(PreProcessService, 'manipulateImage').callsFake(() => self.results[self.index++]);

      DBService.clearDB()
        .then(() => ImageService
          .create(Deserializer.fromMessageBody(JSON.stringify(ModelFactory.legalMessageBody))))
        .then((image) => self.originImage = image)
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.user = user)
        .then(() => self._updateImageActiveUser(self.originImage, new Date(), new Date(), self.user.id))
        .then((image) => self.originImage = image)
        .then(() => Promise.all([
          ImageService.createCropArea(self.originImage.id, self.user, ModelFactory.cropArea1), 
          ImageService.createCropArea(self.originImage.id, self.user, ModelFactory.cropArea1)
        ]))
        .then(cropAreas => 
          Promise.all([
            ImageModel.setCropAreaImage(self.originImage, cropAreas[0].id, 'dummyImaginaryId1', 'dummyImaginaryId1', ''),
            ImageModel.setCropAreaImage(self.originImage, cropAreas[1].id, 'dummyImaginaryId2', 'dummyImaginaryId2', '')
          ])
        )
        .then(() => ImageService.complete(self.originImage.id, self.user, eImageStatus.done, {comment: "comment", clientUrl: "clientUrl"}))
        .then(() => ImageModel.updateStatus(self.originImage, self.user.id, eImageStatus.done, "done image", "xxx"))
        .then(() => ImageModel.findById(self.originImage.id))
        .then((image) => self.originImage = image)
        .then(() => done())
        .catch((err) => done(err))
    });

    afterEach((done) => {
      self.isImageFileStub.restore();
      self.manipulateImageStub.restore();
      done();
    });

    it('should update successfully pre-processing images actions', (done) => {

      self.results = [Promise.resolve({actions: ['rotateX']}), Promise.resolve({actions: ['rotateX', 'rotateY']})];
      ImageIntegrations.sendToPreProcess(self.originImage)
        .then((returnVal) => ImageModel.findById(self.originImage.id))
        .then((image) => {
          expect(self.manipulateImageStub.callCount).to.equal(self.results.length);
          
          var cropAreas = image.cropAreas[0]
          expect(cropAreas.preProcess).to.be.exist
          expect(cropAreas.preProcess.actions).to.be.exist
          expect(cropAreas.preProcess.actions.length).to.be.equal(1)
          expect(cropAreas.preProcess.actions[0]).to.be.equal('rotateX')

          cropAreas = image.cropAreas[1]
          expect(cropAreas.preProcess).to.be.exist
          expect(cropAreas.preProcess.actions).to.be.exist
          expect(cropAreas.preProcess.actions.length).to.be.equal(2)
          expect(cropAreas.preProcess.actions[0]).to.be.equal('rotateX')
          expect(cropAreas.preProcess.actions[1]).to.be.equal('rotateY')
          done()
        })
        .catch(done);
    })

    it('should update successfully only the first cropArea when the second call is rejected', (done) => {

      self.results = [Promise.resolve({actions: ['rotateX']}), Promise.reject('has error')];
      ImageIntegrations.sendToPreProcess(self.originImage)
        .catch((returnVal) => {
          ImageModel.findById(self.originImage.id)
            .then((image) => {
              expect(self.manipulateImageStub.callCount).to.equal(self.results.length);
              
              var cropAreas = image.cropAreas[0]
              expect(cropAreas.preProcess).to.be.exist
              expect(cropAreas.preProcess.actions).to.be.exist
              expect(cropAreas.preProcess.actions.length).to.be.equal(1)
              expect(cropAreas.preProcess.actions[0]).to.be.equal('rotateX')
    
              cropAreas = image.cropAreas[1]
              expect(cropAreas.preProcess).to.be.exist
              expect(cropAreas.preProcess.actions.length).to.be.equal(0)
              
              done();
            })
            .catch(done);
        })
    })

    it('should update successfully the second cropArea when the first pre processing is rejected', (done) => {

      self.results = [Promise.reject('has error'), Promise.resolve({actions: ['rotateX']})];
      ImageIntegrations.sendToPreProcess(self.originImage)
        .catch((returnVal) => {
          ImageModel.findById(self.originImage.id)
            .then((image) => {
              expect(self.manipulateImageStub.callCount).to.equal(self.results.length);
              
              var cropAreas = image.cropAreas[0]
              expect(cropAreas.preProcess).to.be.exist
              expect(cropAreas.preProcess.actions).to.be.exist
              expect(cropAreas.preProcess.actions.length).to.be.equal(0)
    
              cropAreas = image.cropAreas[1]
              expect(cropAreas.preProcess).to.be.exist
              expect(cropAreas.preProcess.actions.length).to.be.equal(1)
              expect(cropAreas.preProcess.actions[0]).to.be.equal('rotateX')
              
              done();
            })
            .catch(done);
        })
    })

    it('should update successfully pre-processing images the first image in a second time', (done) => {

      self.results = [Promise.reject('has error'), Promise.resolve({actions: ['rotateX']}), Promise.resolve({actions: ['rotateY']})];
  
      ImageIntegrations.sendToPreProcess(self.originImage)
        .catch((returnVal) => {
          ImageModel.findById(self.originImage.id)
            .then((image) => {
              self.originImage = image

              expect(self.manipulateImageStub.callCount).to.equal(self.results.length - 1);
              
              var cropAreas = image.cropAreas[0]
              expect(cropAreas.preProcess).to.be.exist
    
              cropAreas = image.cropAreas[1]
              expect(cropAreas.preProcess).to.be.exist
              expect(cropAreas.preProcess.actions).to.be.exist
              expect(cropAreas.preProcess.actions.length).to.be.equal(1)
  
              return ImageIntegrations.sendToPreProcess(self.originImage)
            })
            .then(() => ImageModel.findById(self.originImage.id))
            .then((image) => {
              expect(self.manipulateImageStub.callCount).to.equal(self.results.length);
              
              var cropAreas = image.cropAreas[0]
              expect(cropAreas.preProcess).to.be.exist
              expect(cropAreas.preProcess.actions.length).to.be.equal(1)
    
              done();
            })
            .catch(done);
        })
    })

    it('should not update pre-processing images when image have already updated action but finish successfully', (done) => {

      self.results = [Promise.resolve({actions: ['rotateX']}), Promise.resolve({actions: ['rotateX']})];
  
      ImageIntegrations.sendToPreProcess(self.originImage)
        .then((returnVal) => ImageModel.findById(self.originImage.id))
        .then((image) => {
          self.index = 0
          return ImageIntegrations.sendToPreProcess(self.originImage)
        })
        .then(() => {
          done();
        })
        .catch(done);
    })
    
  });

  describe('.sendToQueue', () => {
    var self = this;

    beforeEach((done) => {
      self.queueApiSendStub = sinon.stub(QueueApi, "send").callsFake(() => { return Promise.resolve("sqsMessageId")});
      self.setCropAreaEnqueuedStub = sinon.stub(ImageModel, "setCropAreaEnqueued").callsFake(() => {
        return Promise.resolve(self.returnImage)
      });
      self.setCropAreaTransactionIdStub = sinon.stub(ImageModel, "setCropAreaTransactionId").callsFake(() => {
        return Promise.resolve(self.returnImage)
      });
      done();
    });

    afterEach((done) => {
      self.queueApiSendStub.restore();
      self.setCropAreaEnqueuedStub.restore();
      self.setCropAreaTransactionIdStub.restore();
      done();
    });

    it('should return undefined if done successfully', (done) => {
      let cropAreaClone1 = _.clone(ModelFactory.cropArea1);

      cropAreaClone1.queue = {transactionId: Factory.newObjectId()};
      self.getQueueUrlStub = sinon.stub(QueueApi, "getQueueUrl").callsFake(() => Promise.resolve<string>("fakeQueueUrl"));
      self.returnImage = {
        id: "dummyImageId",
        imaginaryId: "dummyImaginaryId",
        entityId: "dummyEntityId",
        requestMetadata: {
          workloadId: "dummyWorkloadId",
          transactionId: "dummyTransactionId"
        },
        reportId: "dummyReportId",
        cropAreas: [cropAreaClone1, cropAreaClone1, cropAreaClone1]
      };

      ImageIntegrations.sendToQueue(self.returnImage)
        .then((returnVal) => {
          expect(self.queueApiSendStub.callCount).to.equal(self.returnImage.cropAreas.length);
          expect(self.setCropAreaEnqueuedStub.callCount).to.equal(self.returnImage.cropAreas.length);
          expect(returnVal).to.equal(undefined)
          self.getQueueUrlStub.restore();
          done();
        })
        .catch(done);
    });

    it('should return null if done successfully when no crop areas existing', (done) => {
      self.getQueueUrlStub = sinon.stub(QueueApi, "getQueueUrl").callsFake(() => Promise.resolve("fakeQueueUrl"));

      self.returnImage = {
        id: "dummyImageId",
        imaginaryId: "dummyImaginaryId",
        entityId: "dummyEntityId",
        requestMetadata: {
          workloadId: "dummyWorkloadId",
          transactionId: "dummyTransactionId"
        },
        reportId: "dummyReportId",
        cropAreas: [],
        transactionId: Factory.newObjectId()
      };

      ImageIntegrations.sendToQueue(self.returnImage)
        .then((returnVal) => {
          expect(self.queueApiSendStub.callCount).to.equal(1);
          expect(self.setCropAreaEnqueuedStub.callCount).to.equal(0);
          expect(returnVal).to.be.equal(undefined);

          self.getQueueUrlStub.restore();

          done();
        })
        .catch(done);
    })

    it('should send only crop areas thad did not sent yet', (done) => {
      let cropAreaClone1 = _.clone(ModelFactory.cropArea1);
      let cropAreaClone2 = _.clone(ModelFactory.cropArea1);

      self.getQueueUrlStub = sinon.stub(QueueApi, "getQueueUrl").callsFake(() => Promise.resolve("fakeQueueUrl"));

      cropAreaClone1.id = "cropArea1";
      cropAreaClone2.id = "cropArea2";
      cropAreaClone1.imaginaryId = "cropAreaImageId1";

      cropAreaClone1.queue = {transactionId: Factory.newObjectId()};
      cropAreaClone2.queue = {
        transactionId: Factory.newObjectId(),
        messageId: "messageId",
        enqueuedAt: new Date()
      };

      self.returnImage = {
        id: "dummyImageId",
        imaginaryId: "dummyImaginaryId",
        entityId: "dummyEntityId",
        requestMetadata: {
          workloadId: "dummyWorkloadId",
          transactionId: "dummyTransactionId"
        },
        reportId: "dummyReportId",
        cropAreas: [cropAreaClone1, cropAreaClone2]};

      ImageIntegrations.sendToQueue(self.returnImage)
        .then((returnVal) => {
          expect(self.queueApiSendStub.callCount).to.equal(1);
          expect(self.setCropAreaEnqueuedStub.callCount).to.equal(1);
          expect(returnVal).to.equal(undefined);

          self.getQueueUrlStub.restore();

          done();
        })
        .catch(done);
    });

    it('should resolve without any message sent when all crop areas was already sent', (done) => {
      self.getQueueUrlStub = sinon.stub(QueueApi, "getQueueUrl").callsFake(() => Promise.resolve("fakeQueueUrl"));

      let cropAreaClone1 = _.clone(ModelFactory.cropArea1);

      cropAreaClone1.id = "cropArea1";
      cropAreaClone1.imaginaryId = "cropAreaImageId1";
      cropAreaClone1.queue = {messageId: "messageId", enqueuedAt: new Date()};

      let cropAreaClone2 = _.clone(cropAreaClone1);

      self.returnImage = {
        id: "dummyImageId",
        imaginaryId: "dummyImaginaryId",
        entityId: "dummyEntityId",
        requestMetadata: {
          workloadId: "dummyWorkloadId",
          transactionId: "dummyTransactionId"
        },
        reportId: "dummyReportId",
        cropAreas: [cropAreaClone1, cropAreaClone2]};

      ImageIntegrations.sendToQueue(self.returnImage)
        .then((returnVal) => {
          expect(self.queueApiSendStub.callCount).to.equal(0);
          expect(self.setCropAreaEnqueuedStub.callCount).to.equal(0);
          expect(returnVal).to.equal(undefined)

          self.getQueueUrlStub.restore();

          done();
        })
        .catch(done);
    });

    it('should reject when at least one of the cropAreas sending message was rejected', (done) => {
      let cropAreaClone1 = _.clone(ModelFactory.cropArea1);

      cropAreaClone1.id = "cropArea1";
      cropAreaClone1.queue = {transactionId: Factory.newObjectId()};

      let cropAreaClone2 = _.clone(cropAreaClone1);
      let cropAreaClone3 = _.clone(cropAreaClone1);

      self.queueApiSendStub.restore();
      self.queueApiSendStub = sinon.stub(QueueApi, "send").callsFake(() => { return Promise.reject("ERROR!")});
      self.getQueueUrlStub = sinon.stub(QueueApi, "getQueueUrl").callsFake(() => Promise.resolve("fakeQueueUrl"));

      self.returnImage = {
        id: "dummyImageId",
        imaginaryId: "dummyImaginaryId",
        entityId: "dummyEntityId",
        requestMetadata: {
          workloadId: "dummyWorkloadId",
          transactionId: "dummyTransactionId"
        },
        reportId: "dummyReportId",
        cropAreas: [cropAreaClone1, cropAreaClone2, cropAreaClone3]};

      ImageIntegrations.sendToQueue(self.returnImage)
        .catch((returnVal) => {
          expect(returnVal.length).to.exist.and.equal(3);
          expect(self.queueApiSendStub.callCount).to.equal(3);

          self.getQueueUrlStub.restore();

          done();
        })
        .catch(done);
    });

    it('should reject if updating crop area enqueue data was rejected', (done) => {
      let cropAreaClone1 = _.clone(ModelFactory.cropArea1);

      cropAreaClone1.id = "cropArea1";
      cropAreaClone1.queue = {transactionId: Factory.newObjectId()};

      let cropAreaClone2 = _.clone(cropAreaClone1);
      let cropAreaClone3 = _.clone(cropAreaClone1);

      self.setCropAreaEnqueuedStub.restore();
      self.setCropAreaEnqueuedStub = sinon.stub(ImageModel, "setCropAreaEnqueued").callsFake(() => Promise.reject("ERROR!") );
      self.getQueueUrlStub = sinon.stub(QueueApi, "getQueueUrl").callsFake(() => Promise.resolve("fakeQueueUrl"));

      self.returnImage = {
        id: "dummyImageId",
        imaginaryId: "dummyImaginaryId",
        entityId: "dummyEntityId",
        requestMetadata: {
          workloadId: "dummyWorkloadId",
          transactionId: "dummyTransactionId"
        },
        reportId: "dummyReportId",
        cropAreas: [cropAreaClone1, cropAreaClone2, cropAreaClone3]};

      ImageIntegrations.sendToQueue(self.returnImage)
        .catch((returnVal) => {
          expect(returnVal.length).to.exist.and.equal(3);

          self.getQueueUrlStub.restore();

          done();
        })
        .catch(done);
    });

    it('should reject if imageId is null', (done) => {
      self.returnImage = null;

      ImageIntegrations.sendToQueue(null)
        .catch((e) => {
          expect(e).to.exist;
          done();
        })
        .catch(done);
    });

    it('should reject from sending to queue with error if messageObj is null', (done) => {
      self.getQueueUrlStub = sinon.stub(QueueApi, "getQueueUrl").callsFake(() => Promise.resolve<string>("fakeQueueUrl"));
      self.toQueueObjectsStub = sinon.stub(Serializer, "toQueueObjects").callsFake(() => [null]);      
      
      let cropAreaClone1 = _.clone(ModelFactory.cropArea1);
      cropAreaClone1.queue = {transactionId: Factory.newObjectId()};
      self.image = {
        id: "dummyImageId",
        imaginaryId: "dummyImaginaryId",
        entityId: "dummyEntityId",
        requestMetadata: {
          workloadId: "dummyWorkloadId",
          transactionId: "dummyTransactionId"
        },
        reportId: "dummyReportId",
        cropAreas: [cropAreaClone1, cropAreaClone1, cropAreaClone1]
      };

      ImageIntegrations.sendToQueue(self.image)
        .catch((returnVal) => {
          expect(returnVal[0]).to.equal('Message object="null" is not familiar format') 
          expect(self.toQueueObjectsStub.called).to.be.true;
          expect(self.queueApiSendStub.called).to.be.false;

          self.getQueueUrlStub.restore();
          self.toQueueObjectsStub.restore();
          done();
        })
    })

    it('should reject if sending to queue return messageId as null', (done) => {
      self.queueApiSendStub.restore()
      self.queueApiSendStub = sinon.stub(QueueApi, "send").callsFake(() => { return Promise.resolve(null)});

      self.getQueueUrlStub = sinon.stub(QueueApi, "getQueueUrl").callsFake(() => Promise.resolve<string>("fakeQueueUrl"));
      self.toQueueObjectsStub = sinon.stub(Serializer, "toQueueObjects").callsFake(() => [{}]);      

      let cropAreaClone1 = _.clone(ModelFactory.cropArea1);
      cropAreaClone1.queue = {transactionId: Factory.newObjectId()};
      self.image = {
        id: "dummyImageId",
        imaginaryId: "dummyImaginaryId",
        entityId: "dummyEntityId",
        requestMetadata: {
          workloadId: "dummyWorkloadId",
          transactionId: "dummyTransactionId"
        },
        reportId: "dummyReportId",
        cropAreas: [cropAreaClone1, cropAreaClone1, cropAreaClone1]
      };

      ImageIntegrations.sendToQueue(self.image)
        .catch((returnVal) => {
          expect(self.toQueueObjectsStub.called).to.be.true;
          expect(self.queueApiSendStub.called).to.be.true;

          self.getQueueUrlStub.restore();
          self.toQueueObjectsStub.restore();
          done();
        })
    })
  });

  describe('.filterSentCropAreas', () => {
    it('should return array of all cropAreas when no cropArea have messageId', (done) => {
      let cropAreaClone1 = _.clone(ModelFactory.cropArea1);
      let cropAreaClone2 = _.clone(ModelFactory.cropArea1);
      let cropAreaClone3 = _.clone(ModelFactory.cropArea1);

      let image = {
        id: "dummyImageId",
        imaginaryId: "dummyImaginaryId",
        entityId: "dummyEntityId",
        requestMetadata: {
          workloadId: "dummyWorkloadId",
          transactionId: "dummyTransactionId"
        },
        reportId: "dummyReportId",
        cropAreas: [cropAreaClone1, cropAreaClone2, cropAreaClone3]};

      let filteredCropAreas = ImageIntegrations.filterSentCropAreas(image);

      expect(filteredCropAreas).to.exist;
      expect(filteredCropAreas.length).to.equal(3);
      expect(filteredCropAreas[0].index).to.equal(0);
      expect(filteredCropAreas[1].index).to.equal(1);
      expect(filteredCropAreas[2].index).to.equal(2);
      expect(filteredCropAreas[0].cropArea).to.equal(cropAreaClone1);
      expect(filteredCropAreas[1].cropArea).to.equal(cropAreaClone2);
      expect(filteredCropAreas[2].cropArea).to.equal(cropAreaClone3);

      done();
    });

    it('should return array of cropAreas that have no messageId', (done) => {
      let cropAreaClone1 = _.clone(ModelFactory.cropArea1);
      let cropAreaClone2 = _.clone(ModelFactory.cropArea1);
      let cropAreaClone3 = _.clone(ModelFactory.cropArea1);

      cropAreaClone2.queue = {
        messageId: "messageId"
      };

      let image = {
        id: "dummyImageId",
        imaginaryId: "dummyImaginaryId",
        entityId: "dummyEntityId",
        requestMetadata: {
          workloadId: "dummyWorkloadId",
          transactionId: "dummyTransactionId"
        },
        reportId: "dummyReportId",
        cropAreas: [cropAreaClone1, cropAreaClone2, cropAreaClone3]};

      let filteredCropAreas = ImageIntegrations.filterSentCropAreas(image);

      expect(filteredCropAreas).to.exist;
      expect(filteredCropAreas.length).to.equal(2);
      expect(filteredCropAreas[0].index).to.equal(0);
      expect(filteredCropAreas[1].index).to.equal(2);
      expect(filteredCropAreas[0].cropArea).to.equal(cropAreaClone1);
      expect(filteredCropAreas[1].cropArea).to.equal(cropAreaClone3);

      done();
    });

    it('should return empty array when image have no cropAreas', (done) => {
      let image = {
        id: "dummyImageId",
        imaginaryId: "dummyImaginaryId",
        entityId: "dummyEntityId",
        requestMetadata: {
          workloadId: "dummyWorkloadId",
          transactionId: "dummyTransactionId"
        },
        reportId: "dummyReportId",
        cropAreas: []};

      let filteredCropAreas = ImageIntegrations.filterSentCropAreas(image);

      expect(filteredCropAreas).to.exist;
      expect(filteredCropAreas.length).to.equal(0);

      done();
    });
  });
});
