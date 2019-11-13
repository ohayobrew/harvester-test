import ImageModel from '../models/image/image.model';
import UserModel from '../models/user/user.model';
import * as ModelFactory from '../helpers/tests/modelFactory'
import {ImaginaryService} from "../services/imaginaryService";
import ImageIntegrations from '../utils/imageIntegrations';
import {QueueApi} from "../utils/queueApi";
import {ImageTasks} from "./image.tasks";
import {eImageStatus} from "../models/image/image.model.interface";
import {eImageTask} from "../models/image/image.model.interface";
import * as sinon from 'sinon';
import {expect} from 'chai';

import { DBService } from '../services/dbService';
import ImageService from '../api/v1.0/image/service/imageService';
import { Deserializer } from '../utils/deserializer';
import FeatureService from '../api/v1.0/feature/service/feature.service';
import { ConfigService } from '../services/configService';

const IMAGE_PRE_PROCESS_CONFIG = ConfigService.getConfig('imagePreProcess')
if (!IMAGE_PRE_PROCESS_CONFIG){
  throw new Error("Couldn't find 'imagePreProcess' field in config")
}

const TASKS_CONFIG = ConfigService.getConfig('tasks')
if (!TASKS_CONFIG){
  throw new Error("Couldn't find 'tasks' field in config")
}

const MAX_RETRIES = TASKS_CONFIG.maxRetries

describe("Image Tasks", () => {
  
  function getImageWithCropAreas (user: UserModel, status: eImageStatus, nextTaskStatus: eImageTask) {
    return ModelFactory.Factory.generateImageWithCropAreas(ModelFactory.imageInProgress1, ModelFactory.cropArea1, 2, 1, {
      status: status,
      activeUser: user.id,
      nextTask: {task: nextTaskStatus},
      imaginaryIdOriginal: "imaginaryId1"
    }, ["cloudinary"])
  }

  before((done) => {
    DBService.clearDB().then(done);
  });

  describe(".handler", () => {
    let self = this;
    
    beforeEach((done) => {
      self.createCropImagesStub = sinon.stub(ImageIntegrations, "createCropImages").callsFake(() => Promise.resolve());
      self.createTransactionIdsStub = sinon.stub(ImageIntegrations, "createTransactionIds").callsFake(() => Promise.resolve());
      self.isFeatureOnStub = sinon.stub(FeatureService, 'isFeatureOn').callsFake(() => Promise.resolve(true));
      self.sendToPreProcessStub = sinon.stub(ImageIntegrations, "sendToPreProcess").callsFake(() => Promise.resolve());
      self.sendToQueueStub = sinon.stub(ImageIntegrations, "sendToQueue").callsFake(() => Promise.resolve());
      
      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.user = user)
        .then(() => done())
        .catch(done)
    });

    afterEach((done) => {
      self.createCropImagesStub.restore()
      self.createTransactionIdsStub.restore()
      self.isFeatureOnStub.restore()
      self.sendToPreProcessStub.restore()
      self.sendToQueueStub.restore()
      done()
    });

    it("should resolve when task handler is failing and log the error", (done) => {
      ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgressWithoutTags, {
          status: eImageStatus.waitingTask,
          nextTask: {
            task: eImageTask.processComplete
          },
          imaginaryIdOriginal: "imaginaryId1"
      }, ["cloudinary"]))
        .then((image) => {
          self.image = image;

          ImageTasks.handler(self.image)
            .then((retValue) => {
              expect(retValue).to.not.exist;
              expect(self.image.nextTask.task).to.exist;
              expect(self.image.nextTask.errorLog.length).to.equal(1);
              expect(self.image.nextTask.errorLog[0].task).to.equal(eImageTask.processComplete);
              expect(self.image.nextTask.errorLog[0].message).to.contain("ERROR!");
              expect(self.image.nextTask.retries).to.equal(1);
              expect(self.image.status).to.equal(eImageStatus.error);
              expect(self.image.lastError.task).to.equal(eImageTask.processComplete);
              expect(self.image.lastError.message).to.contain("ERROR!");
              done();
            })
            .catch(() => {done()});
        });
    });

    it("should reject when image have no waiting task", (done) => {
      self.getInfoValue = {id: "1"};

      ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgressWithoutTags, {
          status: eImageStatus.waitingTask,
          nextTask: {
          },
          imaginaryIdOriginal: "imaginaryId1"
        }, ["cloudinary"]))
        .then((image) => {
          self.image = image;

          ImageTasks.handler(self.image)
            .catch((retValue) => {
              expect(retValue).to.exist;
              expect(self.image.nextTask.task).to.not.exist;
              expect(self.image.nextTask.errorLog.length).to.equal(0);
              expect(self.image.nextTask.retries).to.not.exist;
              done();
            })
            .catch(done);
        })
    });
    
    it("should update image next task to waitingTask from convertMultiPageToImage", (done) => {
      self.pdfToImageValue = Promise.resolve({id: "AAAA", cloudinaryId: "cloudinaryId", mimeType: "image/png"})
      self.imaginaryPdfToImageStub = sinon.stub(ImaginaryService, "pdfToImage").callsFake(() => self.pdfToImageValue);
      self.updateCropAreaImageStub = sinon.stub(ImageModel, "updateCropAreaImage").callsFake(() => Promise.resolve());

      const image = getImageWithCropAreas(self.user, eImageStatus.waitingTask, eImageTask.multipageConversion)
      ImageModel.create(image)
      .then((image) => {
        self.image = image;
        ImageTasks.handler(self.image)
          .then(() => ImageModel.findById(self.image.id))
          .then((retImage) => {
            expect(retImage).to.exist;
            expect(retImage.nextTask.task).to.equal(eImageTask.processComplete);
            expect(retImage.status).to.equal(eImageStatus.waitingTask);

            self.imaginaryPdfToImageStub.restore()
            self.updateCropAreaImageStub.restore()
            done();
          })
          .catch(done);
      })
    });

    it("should success and update image with status waitingTask to done", (done) => {
      ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgressWithoutTags, {
          status: eImageStatus.waitingTask,
          nextTask: {
            task: eImageTask.processComplete
          },
          imaginaryIdOriginal: "imaginaryId1"
      }, ["cloudinary"]))
        .then((newImage) => self.image = newImage)
        .then(() => ImageTasks.handler(self.image)) // processComplete
        .then(()=> ImageModel.findById(self.image.id)) 
        .then(image => ImageTasks.handler(image))   // createCropAreas
        .then(()=> ImageModel.findById(self.image.id)) 
        .then(image => ImageTasks.handler(image))   // createTransactionsIds
        .then(()=> ImageModel.findById(self.image.id)) 
        .then(image => ImageTasks.handler(image))   // sendToPreProcess
        .then(()=> ImageModel.findById(self.image.id)) 
        .then(image => ImageTasks.handler(image))   // sendToQueue
        .then(()=> ImageModel.findById(self.image.id)) 
        .then(image => ImageTasks.handler(image))   // processFinished
        .then(()=> ImageModel.findById(self.image.id)) 
        .then(image => {
          expect(image).to.exist
          expect(image.status).to.equal(eImageStatus.done)

          done()
        })
        .catch(done)
    })

    it("should success update image with requestedSkipCrop=true and status waitingTask to done", (done) => {
      self.imaginaryGetInfoStub = sinon.stub(ImaginaryService, "getInfo").callsFake(() => Promise.resolve({}));
      self.imaginaryIsMultiPageTypeStub = sinon.stub(ImaginaryService, "isMultiPageType").callsFake(() => false);
      self.imaginaryIsImageTypeStub = sinon.stub(ImaginaryService, "isImageType").callsFake(() => true);
      
      let reqParsed = {
        imageId: "imageId",
        entityId: "entityId",
        source: "dummy",
        reportId: "reportId",
        requestedSkipCrop: true,
        metadata: {
          workloadId: "workloadId",
          transactionId: "transactionId",
          reportId: "reportId",
          companyId: "entityId"
        }
      }
      ImageService.create(reqParsed)
        .then((newImage) => self.image = newImage)
        .then(() => ImageService.complete(self.image.id, self.user, eImageStatus[eImageStatus.done], {comment: "comment", clientUrl: "clientUrl"}))
        .then(()=> ImageModel.findById(self.image.id))
        .then((image) => self.image = image)
        .then(() => ImageTasks.handler(self.image)) // processComplete
        .then(()=> ImageModel.findById(self.image.id)) 
        .then(image => ImageTasks.handler(image))   // createCropAreas
        .then(()=> ImageModel.findById(self.image.id)) 
        .then(image => ImageTasks.handler(image))   // createTransactionsIds
        .then(()=> ImageModel.findById(self.image.id)) 
        .then(image => ImageTasks.handler(image))   // sendToPreProcess
        .then(()=> ImageModel.findById(self.image.id)) 
        .then(image => ImageTasks.handler(image))   // sendToQueue
        .then(()=> ImageModel.findById(self.image.id)) 
        .then(image => ImageTasks.handler(image))   // processFinished
        .then(()=> ImageModel.findById(self.image.id)) 
        .then(image => {
          expect(image).to.exist
          expect(image.status).to.equal(eImageStatus.done)

          expect(self.imaginaryGetInfoStub.called).to.equal(true)
          expect(self.imaginaryIsMultiPageTypeStub.called).to.equal(true)
          expect(self.imaginaryIsImageTypeStub.called).to.equal(true)

          self.imaginaryGetInfoStub.restore()
          self.imaginaryIsMultiPageTypeStub.restore()
          self.imaginaryIsImageTypeStub.restore()

          done()
        })
        .catch(done)
    })
  })

  describe(".processComplete", () => {

    let self = this;
    
    beforeEach((done) => {
      self.changeStatusStub = sinon.stub(ImageTasks, "changeStatus").callsFake(() => self.changeStatusResult);
      
      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.user = user)
        .then(() => ImageModel.create(getImageWithCropAreas(self.user, eImageStatus.sendingToQueue, eImageTask.processComplete)))
        .then((image) => self.image = image)
        .then(() => done())
        .catch(done)
    });

    afterEach((done) => {
      self.changeStatusStub.restore()
      done()
    });

    it("should update image next task status from processComplete to createCropImages", (done) => {
      self.changeStatusResult = Promise.resolve()
      ImageTasks.completeImage(self.image)
      .then(() => ImageModel.findById(self.image.id))
      .then((retImage) => {
        expect(retImage).to.exist;
        expect(retImage.nextTask.task).to.equal(eImageTask.createCropImages);
        expect(retImage.status).to.equal(eImageStatus.sendingToQueue);
        done();
      })
      .catch(done);
    });

    it("should add error message to image nextTask.errorLog when processComplete process failed", (done) => {
      self.changeStatusResult = Promise.reject(['Some Error'])
      ImageTasks.completeImage(self.image)
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(retImage.nextTask.task).to.equal(eImageTask.processComplete);
          expect(retImage.nextTask.errorLog.length).to.equal(1);

          done();
        })
        .catch(done);
    })

    it("should change image status to error when processComplete failed after max tries", (done) => {
      self.changeStatusResult = Promise.reject(['Some Error'])
      ImageTasks.completeImage(self.image)
        .then(() => ImageTasks.completeImage(self.image))
        .then(() => ImageTasks.completeImage(self.image))
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(retImage.nextTask.task).to.equal(eImageTask.processComplete);
          expect(retImage.status).to.equal(eImageStatus.error)
          expect(retImage.lastError).to.exist
          expect(retImage.lastError.task).to.equal(eImageTask.processComplete)

          done();
        })
        .catch(done);
    })
  })

  describe(".createCropImages", () => {
    let self = this;
    
    beforeEach((done) => {
      self.createCropImagesStub = sinon.stub(ImageIntegrations, "createCropImages").callsFake(() => self.createCropImagesResult);

      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.user = user)
        .then(() => ImageModel.create(getImageWithCropAreas(self.user, eImageStatus.sendingToQueue, eImageTask.createCropImages)))
        .then((image) => self.image = image)
        .then(() => done())
        .catch(done)
    });

    afterEach((done) => {
      self.createCropImagesStub.restore()
      done()
    });

    it("should update image next task status from createCropImages to createTransactionIds", (done) => {
      self.createCropImagesResult = Promise.resolve()
      ImageTasks.createCropImages(self.image)
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(self.createCropImagesStub.called).to.equal(true);
          expect(retImage.nextTask.task).to.equal(eImageTask.createTransactionIds);
          expect(retImage.status).to.equal(eImageStatus.sendingToQueue);
          done();
        })
        .catch(done);
    })

    it("should add error message to image nextTask.log when createCropImages failed", (done) => {
      self.createCropImagesResult = Promise.reject(['Some Error'])
      ImageTasks.createCropImages(self.image)
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(self.createCropImagesStub.called).to.equal(true);
          expect(retImage.nextTask.task).to.equal(eImageTask.createCropImages);
          expect(retImage.nextTask.errorLog.length).to.equal(1);
          done();
        })
        .catch(done);
    })

    it("should change image status to error when createCropImages failed after max tries", (done) => {
      self.createCropImagesResult = Promise.reject(['Some Error'])
      ImageTasks.createCropImages(self.image)
        .then(() => ImageTasks.createCropImages(self.image))
        .then(() => ImageTasks.createCropImages(self.image))
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(self.createCropImagesStub.called).to.equal(true);
          expect(retImage.nextTask.task).to.equal(eImageTask.createCropImages);
          expect(retImage.status).to.equal(eImageStatus.error)
          expect(retImage.lastError).to.exist
          expect(retImage.lastError.task).to.equal(eImageTask.createCropImages)
          done();
        })
        .catch(done);
    })
  });

  describe(".createTransactionIds", () => {

    let self = this;
    
    beforeEach((done) => {
      self.createTransactionIdsStub = sinon.stub(ImageIntegrations, "createTransactionIds").callsFake(() => self.createTransactionIdsResult);
      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.user = user)
        .then(() => ImageModel.create(getImageWithCropAreas(self.user, eImageStatus.sendingToQueue, eImageTask.createTransactionIds)))
        .then((image) => self.image = image)
        .then(() => done())
        .catch(done)
    });

    afterEach((done) => {
      self.createTransactionIdsStub.restore()
      done()
    });

    it("should update image next task status from createTransactionIds to sendToPreProcess", (done) => {
      self.createTransactionIdsResult = Promise.resolve()
      
      ImageTasks.createTransactionIds(self.image)
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(self.createTransactionIdsStub.called).to.equal(true);
          expect(retImage.nextTask.task).to.equal(eImageTask.sendToPreProcess);
          expect(retImage.status).to.equal(eImageStatus.sendingToQueue);
          done();
        })
        .catch(done);
    });

    it("should add error message to image nextTask.errorLog when createTransactionIds failed", (done) => {
      self.createTransactionIdsResult = Promise.reject(['Some Error'])
      
      ImageTasks.createTransactionIds(self.image)
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(self.createTransactionIdsStub.called).to.equal(true);
          expect(retImage.nextTask.task).to.equal(eImageTask.createTransactionIds);
          expect(retImage.nextTask.errorLog.length).to.equal(1);
          done();
        })
        .catch(done);
    })

    it("should change image status to error when createTransactionIds failed after max tries", (done) => {
      self.createTransactionIdsResult = Promise.reject(['Some Error'])
      
      ImageTasks.createTransactionIds(self.image)
        .then(() => ImageTasks.createTransactionIds(self.image))
        .then(() => ImageTasks.createTransactionIds(self.image))
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(self.createTransactionIdsStub.called).to.equal(true);
          expect(retImage.nextTask.task).to.equal(eImageTask.createTransactionIds);
          expect(retImage.status).to.equal(eImageStatus.error)
          expect(retImage.lastError).to.exist
          expect(retImage.lastError.task).to.equal(eImageTask.createTransactionIds)
          done();
        })
        .catch(done);
    })
  })

  describe(".sendToPreProcess", () => {
    let self = this;
    
    beforeEach((done) => {
      self.sendToPreProcessStub = sinon.stub(ImageIntegrations, "sendToPreProcess").callsFake((() => Promise.resolve(self.sendToPreProcessResult)));
      self.isFeatureOnStub = sinon.stub(FeatureService, 'isFeatureOn').callsFake(() => Promise.resolve(true));

      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.user = user)
        .then(() => ImageModel.create(getImageWithCropAreas(self.user, eImageStatus.sendingToQueue, eImageTask.sendToPreProcess)))
        .then((image) => self.image = image)
        .then(() => done())
        .catch(done)
    });

    afterEach((done) => {
      self.sendToPreProcessStub.restore()
      self.isFeatureOnStub.restore()
      done()
    });

    it("should update image next task status from sendToPreProcess to sendToQueue", (done) => {
      self.sendToPreProcessResult = null

      ImageTasks.sendToPreProcess(self.image)
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(self.sendToPreProcessStub.called).to.equal(true);
          expect(retImage.nextTask.task).to.equal(eImageTask.sendToQueue);
          expect(retImage.status).to.equal(eImageStatus.sendingToQueue);
          done();
        })
        .catch(done);
    });

    it("should reject sendToPreProcess process and add error message to image nextTask.errorLog", (done) => {
      self.sendToPreProcessStub.restore()
      self.sendToPreProcessStub = sinon.stub(ImageIntegrations, "sendToPreProcess").callsFake((() => Promise.reject(['Some Error'])));

      ImageTasks.sendToPreProcess(self.image)
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(self.sendToPreProcessStub.called).to.equal(true);
          expect(retImage.nextTask.task).to.equal(eImageTask.sendToPreProcess);
          expect(retImage.nextTask.errorLog.length).to.equal(1);
          done();
        })
        .catch(done);
    })

    it('should skip PreProcess when feature is off', (done) => {
      self.isFeatureOnStub.restore()
      self.isFeatureOnStub = sinon.stub(FeatureService, 'isFeatureOn').callsFake(() => Promise.resolve(false));

      ImageTasks.sendToPreProcess(self.image)
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(self.isFeatureOnStub.called).to.equal(true);
          expect(self.sendToPreProcessStub.notCalled).to.equal(true);
          expect(retImage.nextTask.task).to.equal(eImageTask.sendToQueue);
          expect(retImage.status).to.equal(eImageStatus.sendingToQueue);

          done();
        })
        .catch(done);
    });

    it('should stay in sendToPreProcess status when feature flag had exception without increment the retries', (done) => {
      self.isFeatureOnStub.restore()
      self.isFeatureOnStub = sinon.stub(FeatureService, 'isFeatureOn').callsFake(() => Promise.reject("error"));

      ImageTasks.sendToPreProcess(self.image)
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(self.isFeatureOnStub.called).to.equal(true);
          expect(self.sendToPreProcessStub.notCalled).to.equal(true);
          expect(retImage.nextTask.task).to.equal(eImageTask.sendToPreProcess);
          expect(retImage.nextTask.retries).to.not.exist;
          expect(retImage.nextTask.errorLog.length).to.equal(1);

          done();
        })
        .catch(done);
    })

    it('should update image next task status from sendToPreProcess to sendToQueue when retries > max retries', (done) => {
      self.sendToPreProcessStub.restore()
      self.sendToPreProcessStub = sinon.stub(ImageIntegrations, "sendToPreProcess").callsFake((() => Promise.reject(['Some Error'])));

      ImageModel.findById(self.image.id)
        .then((image) => ImageTasks.sendToPreProcess(image))
        .then(() => ImageModel.findById(self.image.id))
        .then((image) => ImageTasks.sendToPreProcess(image))
        .then(() => ImageModel.findById(self.image.id))
        .then((image) => ImageTasks.sendToPreProcess(image))
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(self.isFeatureOnStub.called).to.equal(true);
          expect(self.sendToPreProcessStub.called).to.equal(true);
          expect(retImage.nextTask.task).to.equal(eImageTask.sendToQueue);
          expect(retImage.nextTask.errorLog.length).to.equal(MAX_RETRIES);
          expect(retImage.nextTask.retries).to.equal(0);

          done();
        })
        .catch(done);
    })
  })

  describe(".sendToQueue", () => {
    let self = this;
    
    beforeEach((done) => {
      self.sendToQueueStub = sinon.stub(ImageIntegrations, "sendToQueue").callsFake(() => self.sendToQueueResult);
      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.user = user)
        .then(() => ImageModel.create(getImageWithCropAreas(self.user, eImageStatus.sendingToQueue, eImageTask.sendToQueue)))
        .then((image) => self.image = image)
        .then(() => done())
        .catch(done)
    });

    afterEach((done) => {
      self.sendToQueueStub.restore()
      done()
    });

    it("should update image next task status from sendToQueue to processFinished", (done) => {
      self.sendToQueueResult = Promise.resolve()
      ImageTasks.sendToQueue(self.image)
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(self.sendToQueueStub.called).to.equal(true);
          expect(retImage.nextTask.task).to.equal(eImageTask.processFinished);
          expect(retImage.status).to.equal(eImageStatus.sendingToQueue);
          done();
        })
        .catch(done);
    });

    it("should add error message to image nextTask.errorLog when sendToQueue process failed", (done) => {
      self.sendToQueueResult = Promise.reject(['Some Error'])
      ImageTasks.sendToQueue(self.image)
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(self.sendToQueueStub.called).to.equal(true);
          expect(retImage.nextTask.task).to.equal(eImageTask.sendToQueue);
          expect(retImage.nextTask.errorLog.length).to.equal(1);
          done();
        })
        .catch(done);
    })

    it("should change image status to error when sendToQueue failed after max tries", (done) => {
      self.sendToQueueResult = Promise.reject(['Some Error'])
      ImageTasks.sendToQueue(self.image)
        .then(() => ImageTasks.sendToQueue(self.image))
        .then(() => ImageTasks.sendToQueue(self.image))
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(self.sendToQueueStub.called).to.equal(true);
          expect(retImage.nextTask.task).to.equal(eImageTask.sendToQueue);
          expect(retImage.status).to.equal(eImageStatus.error)
          expect(retImage.lastError).to.exist
          expect(retImage.lastError.task).to.equal(eImageTask.sendToQueue)
          done();
        })
        .catch(done);
    })
  })

  describe(".processFinished", () => {
    let self = this;
    
    beforeEach((done) => {

      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.user = user)
        .then(() => ImageModel.create(getImageWithCropAreas(self.user, eImageStatus.sendingToQueue, eImageTask.processFinished)))
        .then((image) => self.image = image)
        .then(() => done())
        .catch(done)
    });

    it("should update image status to done after process finished", (done) => {
      ImageTasks.closeTask(self.image)
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(retImage.nextTask.task).to.not.exist;
          expect(retImage.status).to.equal(eImageStatus.done);
          done();
        })
        .catch(done);
    })

    it("should add error message to image nextTask.log when processFinished process failed", (done) => {
      self.changeStatusStub = sinon.stub(ImageTasks, "changeStatus").callsFake(() => Promise.reject(['Some Error']));

      ImageTasks.closeTask(self.image)
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(retImage.nextTask.task).to.equal(eImageTask.processFinished);
          expect(retImage.nextTask.errorLog.length).to.equal(1);

        self.changeStatusStub.restore()

          done();
        })
        .catch(done);
    })

    it("should change image status to error when processFinished failed after max tries", (done) => {
      self.changeStatusStub = sinon.stub(ImageTasks, "changeStatus").callsFake(() => Promise.reject(['Some Error']));

      ImageTasks.closeTask(self.image)
        .then(() => ImageTasks.closeTask(self.image))
        .then(() => ImageTasks.closeTask(self.image))
        .then(() => ImageModel.findById(self.image.id))
        .then((retImage) => {
          expect(retImage).to.exist;
          expect(retImage.nextTask.task).to.equal(eImageTask.processFinished);
          expect(retImage.status).to.equal(eImageStatus.error)
          expect(retImage.lastError).to.exist
          expect(retImage.lastError.task).to.equal(eImageTask.processFinished)

        self.changeStatusStub.restore()

          done();
        })
        .catch(done);
    })
  })

  describe('.changeStatus', () => {
    var self = this;

    beforeEach((done) => {
      self.imageUpdateStatusStub = sinon.stub(ImageModel, "updateStatus").callsFake(() => { return Promise.resolve(self.returnIsStatusChanged)});

      DBService.clearDB()
        .then( () => 
          ImageService.create(Deserializer.fromMessageBody(JSON.stringify(ModelFactory.legalMessageBody))))
        .then(image => self.image = image)
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then(user => self.user = user)
        .then(() => done())
    });

    afterEach((done) => {
      self.imageUpdateStatusStub.restore();
      done();
    });


    it('should return null when status changed', (done) => {
      self.returnIsStatusChanged = true;

      ImageTasks.changeStatus(self.image, eImageStatus.creatingInvoices)
        .then((returnVal) => {
          expect(returnVal).to.equal(null);
          done();
        })
        .catch(done);
    });

    it('should reject when status was not changed', (done) => {
      self.returnIsStatusChanged = false;

      ImageTasks.changeStatus(self.image, eImageStatus.creatingInvoices)
        .catch((returnVal) => {
          expect(returnVal).to.exist;
          done();
        })
        .catch(done);
    });
  });

  describe(".convertMultiPageTask", () => {
    var self = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => {
          self.imaginaryPdfToImageStub = sinon.stub(ImaginaryService, "pdfToImage").callsFake(() => self.pdfToImageValue);
          self.queueApiSendStub = sinon.stub(QueueApi, "send").callsFake(() => Promise.resolve("sqsMessageId"));
          self.getQueueUrlStub = sinon.stub(QueueApi, "getQueueUrl").callsFake(() => Promise.resolve("fakeQueueUrl"));
        })
        .then(() => ImageModel.create(ModelFactory.imagePDFWithMultiPages))
        .then((image) => self.image = image)
        .then(() => done());
    });

    afterEach(() => {
      self.imaginaryPdfToImageStub.restore()
      self.queueApiSendStub.restore()
      self.getQueueUrlStub.restore()
    });

    it("should resolve and successfully convert pdf to image", (done) => {
      self.pdfToImageValue = Promise.resolve({id: "AAAA", cloudinaryId: "cloudinaryId", mimeType: "image/png"})

      ImageTasks.convertMultiPageToImage(self.image)
        .then( () => ImageModel.findById(self.image.id))
        .then((image) => {
          expect(image).is.exist
          expect(self.imaginaryPdfToImageStub.calledOnce).to.equal(true);
          expect(image.status).to.equal(eImageStatus.waitingTask)
          expect(image.nextTask.task).to.equal(eImageTask.processComplete)
          done();
        })
        .catch(done);
    });

    it("should add error message nextTask.errorLog when converting pdf to image faild", (done) => {
      const errorMessage = "some error"
      self.pdfToImageValue = Promise.reject([errorMessage])
      self.updateCropAreaImageStub = sinon.stub(ImageModel, "updateCropAreaImage").callsFake(() => Promise.resolve());
      self.updateStatusStub = sinon.stub(ImageModel, "updateStatus").callsFake(() => Promise.resolve());

      ImageTasks.convertMultiPageToImage(self.image)
        .then(() => ImageModel.findById(self.image.id))
        .then((image) => {
          expect(image).to.exist;
          expect(image.nextTask.errorLog).to.exist
          expect(image.nextTask.errorLog[0].message).to.equal(errorMessage)
          expect(image.nextTask.errorLog.length).to.equal(1);
          
          expect(self.imaginaryPdfToImageStub.calledOnce).to.equal(true);
          expect(self.updateStatusStub.notCalled).to.equal(true);
          expect(self.updateCropAreaImageStub.notCalled).to.equal(true);

          self.updateCropAreaImageStub.restore()
          self.updateStatusStub.restore()

          done();
        })
        .catch(done);
    })
  });
});
