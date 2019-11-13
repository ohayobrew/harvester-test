import { ConfigService } from './../../../../services/configService';
import ImageModel from '../../../../models/image/image.model';
import UserModel from '../../../../models/user/user.model';
import * as ModelFactory from '../../../../helpers/tests/modelFactory'
import ImageService from './imageService';
import * as _ from 'lodash';
import {ImaginaryService} from "../../../../services/imaginaryService";
import {LemmingsService} from "../../../../services/lemmingsService";
import BaseTest from '../../../../helpers/tests/base';
import * as sinon from 'sinon';
const mongoose = require('mongoose');
const {expect} = require('chai');
import ConfigModel from "../../../../models/config/config.model";
import {eImageStatus, IImageModel, eImageTask} from "../../../../models/image/image.model.interface";
import {ERR_LOCKED_BY_OTHER_USER} from './imageService';
import {IUserModel} from '../../../../models/user/user.model.interface';
import {Deserializer} from '../../../../utils/deserializer';
import { DBService } from '../../../../services/dbService';
import {Promise} from "mongoose";

const skipcropped = ConfigService.getConfig('skipcropped')
const NUMBER_OF_PAGES = skipcropped.maxPages

describe("Image Service v1.0", () => {
  before((done) => {
    DBService.clearDB().then(done);
  });

  describe(".next", () => {
    let userWithInhouseTag;
    let self = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => ImageModel.create(ModelFactory.imageInProgressA))
        .then((image) => {
          self.image = image;
          return UserModel.createUser(ModelFactory.userWithInhouseTag);
        })
        .then((user) => self.userWithInhouseTag = user)
        .then(() => done())
        .catch(done);
    });

    it("should return image for existing user", (done) => {

      ImageService.next(self.userWithInhouseTag)
        .then(image => {
          expect(image).to.exist;
          expect(image).to.have.property("id")
            .and.to.equal(self.image.id);

          done();
        })
        .catch(done);
    });

    it("should fail to return image for non-existing user", (done) => {

      ImageModel.create(ModelFactory.imageInProgressWithoutTags)
        .then(() => ImageService.next(undefined))
        .then(image => {
          expect(image).not.to.be.exist;

          done();
        })
        .catch(done);
    });

    it("should return null if no image available", (done) => {

      Promise.resolve(mongoose.model("Image").remove({})) // clear all images
      .then(() => ImageService.next(self.userWithInhouseTag))
      .then(image => {
        expect(image).to.be.null;

        done();
      })
      .catch(done);
    })
  });

  describe(".byId", () => {
    let self = this;

    it("should return image if found", (done) => {

      ImageModel.create(ModelFactory.imageInProgressWithoutTags)
        .then((image) => {
          self.image = image;
          return ImageService.byId(image.id);
        })
        .then(image => {
          expect(image).to.exist;
          expect(image).to.have.property("id")
            .and.to.equal(self.image.id);

          done();
        })
        .catch(done);
    });

    it("should return null if image not found", (done) => {

      ImageService.byId("foo")
      .then(image => {
        expect(image).to.be.null;
        done();
      })
      .catch(done);
    })
  });

  describe(".createCropArea", () => {
    let self = this;

    beforeEach((done) => {
      DBService.clearDB()
      .then(() => UserModel.createUser(ModelFactory.userWithInhouseTag))
      .then((user) => {
        self.userWithInhouseTag = user;

        let imageJson: IImageModel = _.cloneDeep(ModelFactory.imageInProgressA);
        imageJson.activeUser = user.id;
        return ImageModel.create(imageJson);
      })
      .then((image) => {
        self.image = image;
      })
      .then(done)
      .catch(done);
    });

    it("should add crop area to existing image", (done) => {

      ImageService.createCropArea(self.image.id, self.userWithInhouseTag, ModelFactory.cropAreaRequestBody1)
        .then((cropArea) => {
          self.cropArea = cropArea;
          return ImageModel.findById(self.image.id)
        })
        .then(image => {
          expect(self.cropArea).to.exist;
          expect(self.cropArea.createdByUserId).to.equal(self.userWithInhouseTag.id);
          expect(image.cropAreas.length).to.equal(1);
          expect(self.cropArea).to.have.property("id")
            .and.to.equal(image.cropAreas[0].id);

          done();
        })
        .catch(done);
    });

    it("should DO add crop area to existing image locked by other user, when image IS NOT in inProgress status", (done) => {
      //create the first crop under user userWithInhouseTag
      ImageService.createCropArea(self.image.id, self.userWithInhouseTag, ModelFactory.cropAreaRequestBody1)
        .then((cropArea) => {
          expect(cropArea.createdByUserId).to.equal(self.userWithInhouseTag.id);
        })
        //set the image to done state
        .then(() => {
          return ImageService.complete(self.image.id, self.userWithInhouseTag, eImageStatus[eImageStatus.done], {comment: "comment", clientUrl: "clientUrl"});
        })
        //create the second user (the cropping manager that allows to crop)
        .then(() => {
          let userJson: IUserModel = _.cloneDeep(ModelFactory.userWithInhouseTag);
          userJson.vatboxUserId = "user2";
          return UserModel.createUser(userJson);
        })
        //create the second crop area
        .then((user) => {
          self.user2 = user;
          return ImageService.createCropArea(self.image.id, self.user2, ModelFactory.cropAreaRequestBody1)
        })
        .then(() => done())
        .catch((error) => {
          expect(error.name).to.equal(ERR_LOCKED_BY_OTHER_USER);
          done();
        });
    });

    it("should fail to add crop area to existing image locked by other user", (done) => {
      //create the first crop under user userWithInhouseTag
      ImageService.createCropArea(self.image.id, self.userWithInhouseTag, ModelFactory.cropAreaRequestBody1)
        .then((cropArea) => {
          expect(cropArea.createdByUserId).to.equal(self.userWithInhouseTag.id);
        })
        //create the second user
        .then(() => {
          let userJson: IUserModel = _.cloneDeep(ModelFactory.userWithInhouseTag);
          userJson.vatboxUserId = "user2";
          return UserModel.createUser(userJson);
        })
        //create the second crop area
        .then((user) => {
          self.user2 = user;
          return ImageService.createCropArea(self.image.id, self.user2, ModelFactory.cropAreaRequestBody1)
        })
        .then((cropArea) => {
          //we should never get here
          expect(true).to.equal(false);
          done();
        })
        .catch((error) => {
          expect(error.name).to.equal(ERR_LOCKED_BY_OTHER_USER);
          done();
        });
    });

    it("should return null if image not exist", (done) => {

      ImageService.createCropArea("foo", self.userWithInhouseTag, ModelFactory.cropAreaRequestBody1)
        .then(cropArea => {
          expect(cropArea).to.equal.null;

          done();
        })
        .catch(done);
    });

    it('should reject creating cropArea when status is done', (done) => {

      ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageDoneWithoutTags))
        .then((image) => {
          self.image = image;
          return ImageService.createCropArea(image.id, self.userWithInhouseTag, ModelFactory.cropAreaRequestBody1)
        })
        .catch(rejectMessage => {
          expect(rejectMessage).to.exist;

          ImageModel.findById(self.image.id)
          .then((image) => {
            expect(image.cropAreas.length).to.equal(0);
            expect(image.updatedAt).to.be.undefined;
            done();
          })
          .catch(done)
        })
        .catch(done);
    });
  });

  describe(".deleteCropArea", () => {
    let self = this;
    let userWithInhouseTag;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => ImageModel.create(ModelFactory.imageInProgressA))
        .then((image) => {
          self.image = image;
          return UserModel.createUser(ModelFactory.userWithInhouseTag);
        })
        .then((user) => self.userWithInhouseTag = user)
        .then(() => done())
        .catch(done);
    });

    it("should delete successfully specific cropArea and return true", (done) => {
      self.image.createCropArea(self.userWithInhouseTag.id, ModelFactory.cropAreaRequestBody1)
        .then((cropArea) => ImageService.deleteCropArea(self.image.id, cropArea.id))

        .then(wasDeleted => expect(wasDeleted).to.equal(true))
        .then(() => ImageModel.findById(self.image.id))
        .then((image) => expect(image.cropAreas.length).to.equal(0))
        .then(() => done())
        .catch(done);
    });

    it("should return false if image is not exist", (done) => {
      self.image.createCropArea(self.userWithInhouseTag.id, ModelFactory.cropAreaRequestBody1)
        .then((cropArea) => ImageService.deleteCropArea("56b9b66d662c0f3a55a30b67", cropArea.id))

        .then(wasDeleted => expect(wasDeleted).to.equal(false))
        .then(() => ImageModel.findById(self.image.id))
        .then((image) => expect(image.cropAreas.length).to.equal(1))
        .then(() => done())
        .catch(done);
    });

    it("should return false if cropArea is not exist", (done) => {
      self.image.createCropArea(self.userWithInhouseTag.id, ModelFactory.cropAreaRequestBody1)
        .then((cropArea) => ImageService.deleteCropArea("56b9b66d662c0f3a55a30b67", cropArea.id))

        .then(wasDeleted => expect(wasDeleted).to.equal(false))
        .then(() => ImageModel.findById(self.image.id))
        .then((image) => expect(image.cropAreas.length).to.equal(1))
        .then(() => done())
        .catch(done);
    });


    it('should reject deleting cropArea when status is done', (done) => {

      ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1))
        .then((image) => {
          self.image2 = image;
          return image.createCropArea(self.userWithInhouseTag.id, ModelFactory.cropAreaRequestBody1)
        })
        .then((cropArea) => self.image2.done(self.userWithInhouseTag.id, null, null))
        .then(() => ImageService.deleteCropArea(self.image2.id, self.image2.cropAreas[0].id))

        .catch(rejectMessage => {
          expect(rejectMessage).to.exist;

          ImageModel.findById(self.image2.id)
            .then((image) => {
              expect(image.cropAreas.length).to.equal(1);
              done();
            })
            .catch(done)
        })
        .catch(done);
    });
  });

  describe(".complete", () => {
    let self = this;
    let userWithInhouseTag;

    beforeEach((done) => {
      DBService.clearDB()
      .then(() => ImageModel.create(ModelFactory.imageInProgressWithCropAreas))
      .then((image) => {
        self.image = image;
        self.updateStatusStub = sinon.stub(ImageModel, "updateStatus").callsFake((image: ImageModel, userId: string, status: eImageStatus, comment: string, clientUrl: string) => {
          expect(userId).to.equal(self.userWithInhouseTag.id);
          return Promise.resolve(self.returnValue)
        });
        return UserModel.createUser(ModelFactory.userWithInhouseTag);
      })
      .then((user) => self.userWithInhouseTag = user)
      .then(() => done());
    });

    afterEach(() => {
      self.updateStatusStub.restore();
    });

    const _onSuccess = (isStatusChanged) => {
      expect(isStatusChanged).to.equal(self.returnValue);
      expect(self.updateStatusStub.calledOnce).to.equal(true);
    };

    it("should return true if status was changed successfully to done", (done) => {
      self.returnValue = true;

      ImageService.complete(self.image.id, self.userWithInhouseTag, eImageStatus[eImageStatus.done], {comment: "comment", clientUrl: "clientUrl"})
        .then(_onSuccess)
        .then(() => done())
        .catch(done);
    });

    it("should return true if status was changed successfully to rejected", (done) => {
      self.returnValue = true;

      ImageService.complete(self.image.id, self.userWithInhouseTag, eImageStatus[eImageStatus.rejected], {comment: "comment", clientUrl: "clientUrl"})
        .then(_onSuccess)
        .then(() => done())
        .catch(done);
    });

    it("should return false if status was not changed to done", (done) => {
      self.returnValue = false;

      ImageService.complete(self.image.id, self.userWithInhouseTag, eImageStatus[eImageStatus.done], {comment: "comment", clientUrl: "clientUrl"})
        .then(_onSuccess)
        .then(() => done())
        .catch(done);
    });

    it("should return false if image not exist", (done) => {
      self.returnValue = null;

      ImageService.complete(ModelFactory.objectId1, self.userWithInhouseTag, eImageStatus[eImageStatus.done], {comment: "comment", clientUrl: "clientUrl"})
        .then((isStatusChanged) => {
          expect(isStatusChanged).to.equal(false);
          expect(self.updateStatusStub.calledOnce).to.equal(false);
        })
        .then(() => done())
        .catch(done);
    });

    it('should reject done action when and status is done', (done) => {

      ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageDoneWithoutTags))
        .then((image) => {
          self.image = image;
          return ImageService.complete(image.id, self.userWithInhouseTag, eImageStatus[eImageStatus.done], {comment: "comment", clientUrl: "clientUrl"})
        })

        .catch(rejectMessage => {
          expect(rejectMessage).to.exist;

          ImageModel.findById(self.image.id)
            .then((image) => {
              expect(image.updatedAt).to.be.undefined;
              done();
            })
            .catch(done)
        })
        .catch(done);
    });
  });

  describe(".query", () => {
    let self = this;
    let userWithInhouseTag;

    beforeEach((done) => {
      DBService.clearDB()
      .then(() => ImageModel.create(ModelFactory.imageInProgressA))
      .then((image) => {
        self.image = image;
        self.queryStub = sinon.stub(ImageModel, "query").callsFake(() => Promise.resolve(self.returnValue))
      })
      .then(() => done());
    });

    afterEach((done) => {
      self.queryStub.restore();
      DBService.clearDB()
      .then(done)
      .catch(done)
    });

    it("should return one result object if image exist", (done) => {
      self.returnValue = {total: 1, images: [new ImageModel(self.image)]};

      ImageService.query({status: "inProgress"}, 3, 0)
        .then((results) => {
          expect(results).to.exist;
          expect(results.total).to.equal(self.returnValue.total);
          expect(self.queryStub.calledOnce).to.equal(true);
          done()
        })
        .catch(done);
    });

    it("should return null if query did not succeeded", (done) => {
      self.returnValue = null;

      ImageService.query({status: "inProgress"}, 3, 0)
        .then((results) => {
          expect(results).to.not.exist;
          expect(self.queryStub.calledOnce).to.equal(true);
          done()
        })
        .catch(done);
    });
  })

  describe(".reportByEntitiesStatuses", () => {
    let self = this;

    before((done) => {
      DBService.clearDB()
      .then(() => done());
    });

    afterEach(() => {
      self.reportStub.restore();
    });

    it("should resolve with results on success", (done) => {
      self.reportStub = sinon.stub(ImageModel, "reportByEntitiesStatuses").callsFake(() => {
        return Promise.resolve([])
      });

      ImageService.reportByEntitiesStatuses()
        .then((results) => {
          expect(results).to.exist;
          expect(self.reportStub.calledOnce).to.equal(true);
        })
        .then(() => done())
        .catch(done);
    });

    it("should reject when fail", (done) => {
      self.reportStub = sinon.stub(ImageModel, "reportByEntitiesStatuses").callsFake(() => {
        return Promise.reject("ERROR");
      });

      ImageService.reportByEntitiesStatuses()
        .catch((results) => {
          expect(results).to.equal("ERROR");
          expect(self.reportStub.calledOnce).to.equal(true);
        })
        .then(() => done())
        .catch(done);
    });
  });

  describe(".reportByEntitiesStatusInProgress", () => {
    let self = this;

    before((done) => {
      DBService.clearDB()
      .then(done);
    });

    afterEach((done) => {
      self.reportStub.restore();
      DBService.clearDB()
      .then(done);
    });

    it("should resolve with results on success", (done) => {
      self.reportStub = sinon.stub(ImageModel, "reportByEntitiesStatusInProgress").callsFake( () => Promise.resolve([]) );

      ImageService.reportByEntitiesStatusInProgress()
        .then((results) => {
          expect(results).to.exist;
          expect(self.reportStub.calledOnce).to.equal(true);
          done()
        })
        .catch(done);
    });

    it("should reject when fail", (done) => {
      self.reportStub = sinon.stub(ImageModel, "reportByEntitiesStatusInProgress").callsFake( () => Promise.reject("ERROR") );

      ImageService.reportByEntitiesStatusInProgress()
        .catch((results) => {
          expect(results).to.equal("ERROR");
          expect(self.reportStub.calledOnce).to.equal(true);
          done()
        })
        .catch(done);
    });
  });

  describe(".reportByEntities", () => {
    let self = this;

    before((done) => {
      DBService.clearDB()
      .then(done);
    });

    afterEach(() => {
      self.reportStub.restore();
    });

    it("should resolve with results on success", (done) => {
      self.reportStub = sinon.stub(ImageModel, "reportByEntities").callsFake(() => {
        return Promise.resolve([])
      });

      ImageService.reportByEntities(ModelFactory.Factory.subtractMinutesFromNowToDate(10), new Date())
        .then((results) => {
          expect(results).to.exist;
          expect(self.reportStub.calledOnce).to.equal(true);
        })
        .then(() => done())
        .catch(done);
    });

    it("should reject when fail", (done) => {
      self.reportStub = sinon.stub(ImageModel, "reportByEntities").callsFake(() => {
        return Promise.reject("ERROR");
      });

      ImageService.reportByEntities(ModelFactory.Factory.subtractMinutesFromNowToDate(10), new Date())
        .catch((results) => {
          expect(results).to.equal("ERROR");
          expect(self.reportStub.calledOnce).to.equal(true);
        })
        .then(() => done())
        .catch(done);
    });
  });

  describe(".reportByUsers", () => {
    let self = this;

    afterEach(() => {
      self.imageModelReportByUsersStub.restore();
      self.userModelFindByIdsStub.restore();
      self.lemmingsGetUsersStub.restore();
    });

    let reportByUsersResults = {
      "done": 1,
      "rejected": 1,
      "cropAreas": 10
    };

    it("should resolve with results on success", (done) => {
      self.imageModelReportByUsersStub = sinon.stub(ImageModel, "reportByUsers").callsFake(() => {
        let retObject = {};

        retObject[ModelFactory.userWithoutTags.id] = reportByUsersResults;

        return Promise.resolve(retObject);
      });

      self.userModelFindByIdsStub = sinon.stub(UserModel, "findByIds").callsFake(() => {
        return Promise.resolve([ModelFactory.userWithoutTags]);
      });

      let lemmingsResults = {
        notFound: [],
        found: [{
          _id: ModelFactory.userWithoutTags.vatboxUserId,
          email: ModelFactory.userWithoutTags.email,
          firstName: "john",
          lastName: "doe",
          active: true
        }]
      };

      let userVbId = ModelFactory.userWithoutTags.vatboxUserId.toString();

      self.lemmingsGetUsersStub = sinon.stub(LemmingsService, "getUsers").callsFake(() => {
        return Promise.resolve(lemmingsResults);
      });

      ImageService.reportByUsers("my_id", ModelFactory.Factory.subtractMinutesFromNowToDate(10), new Date())
        .then((results) => {
          expect(results).to.exist.and.have.property(userVbId);
          expect(results[userVbId]).have.property("name")
            .equal(`${lemmingsResults.found[0].firstName} ${lemmingsResults.found[0].lastName}`);
          expect(results[userVbId]).have.property("done").equal(reportByUsersResults.done);
          expect(results[userVbId]).have.property("rejected").equal(reportByUsersResults.rejected);
          expect(results[userVbId]).have.property("cropAreas").equal(reportByUsersResults.cropAreas);
          expect(self.imageModelReportByUsersStub.calledOnce).to.equal(true);
          expect(self.userModelFindByIdsStub.calledOnce).to.equal(true);
          expect(self.lemmingsGetUsersStub.calledOnce).to.equal(true);

          done();
        })
        .catch(done);
    });

    it("should resolve with null if no results are available", (done) => {
      self.imageModelReportByUsersStub = sinon.stub(ImageModel, "reportByUsers").callsFake(() => {
        return Promise.resolve(null);
      });

      ImageService.reportByUsers("my_id", ModelFactory.Factory.subtractMinutesFromNowToDate(10), new Date())
        .then((results) => {
          expect(results).to.equal(null);

          done();
        })
        .catch(done);
    });

    it("should reject when fail", (done) => {
      self.imageModelReportByUsersStub = sinon.stub(ImageModel, "reportByUsers").callsFake(() => {
        let retObject = {};

        retObject[ModelFactory.userWithoutTags.id] = reportByUsersResults;

        return Promise.resolve(retObject);
      });

      self.userModelFindByIdsStub = sinon.stub(UserModel, "findByIds").callsFake(() => {
        return Promise.resolve([ModelFactory.userWithoutTags]);
      });

      let userVbId = ModelFactory.userWithoutTags.vatboxUserId.toString();

      self.lemmingsGetUsersStub = sinon.stub(LemmingsService, "getUsers").callsFake(() => {
        return Promise.reject("ERROR!");
      });

      ImageService.reportByUsers("my_id", ModelFactory.Factory.subtractMinutesFromNowToDate(10), new Date())
        .catch((results) => {
          expect(results).to.exist.and.equal("ERROR!");
          expect(self.imageModelReportByUsersStub.calledOnce).to.equal(true);
          expect(self.userModelFindByIdsStub.calledOnce).to.equal(true);
          expect(self.lemmingsGetUsersStub.calledOnce).to.equal(true);

          done();
        })
        .catch(done);
    });
  });

  describe(".create", () => {
    let self = this;
    let userWithInhouseTag;

    beforeEach((done) => {
      DBService.clearDB()
      .then(() => {
        let configModel: any = {considerExistingEntity: (entityId: string) => {} };

        self.configGetConfigStub = sinon.stub(ConfigModel, "getConfig").callsFake(() => Promise.resolve(configModel));
        self.configConsiderExistingEntityStub = sinon.stub(configModel, "considerExistingEntity").callsFake(() => Promise.resolve(true));

        self.createStub = sinon.stub(ImageModel, "create").callsFake((image) => {
          return Promise.resolve(new ImageModel(self.createValue))
        });

        self.imaginaryGetInfoConvertedStub = sinon.stub(ImaginaryService, "getInfoConverted").callsFake(() => {
          return Promise.resolve(self.getInfoValue)
        });

        self.imaginaryGetInfoStub = sinon.stub(ImaginaryService, "getInfo").callsFake(() => Promise.resolve({}));
        self.imaginaryIsImageTypeStub = sinon.stub(ImaginaryService, "isImageType").callsFake(() => self.getIsImageFileValue);
        self.imaginaryIsMultiPageTypeStub = sinon.stub(ImaginaryService, "isMultiPageType").callsFake(() => false);
      })
      .then(() => done());
    });

    afterEach(() => {
      self.createStub.restore();
      self.imaginaryGetInfoConvertedStub.restore();
      self.configGetConfigStub.restore();
      self.imaginaryGetInfoStub.restore();
      self.imaginaryIsImageTypeStub.restore();
      self.imaginaryIsMultiPageTypeStub.restore();
    });

    it("should return ImageModel instance if succeeded creating new image", (done) => {
      self.createValue = _.cloneDeep(ModelFactory.imageInProgress1);
      self.createValue._id = ModelFactory.objectId1;

      let legalMessageBody = {
        metadata: {
          workloadId: self.createValue.requestMetadata.workloadId,
          reportId: self.createValue.requestMetadata.reportId,
          companyId: self.createValue.requestMetadata.companyId,
          transactionId: self.createValue.requestMetadata.transactionId,
          version: self.createValue.requestMetadata.version,
        },
        data: {
          imageId: self.createValue.imaginaryId, // imaginaryId is the property name in db,
          entityId: self.createValue.entityId,
          tags: self.createValue.tags,
          source: self.createValue.source,
          reportId: self.createValue.reportId
        }
      };

      // no imaginary call should be made
      self.getInfoValue = null;

      ImageService.create(Deserializer.fromMessageBody(JSON.stringify(legalMessageBody)))
        .then((image) => {
          expect(image).to.exist;
          expect(image.id).to.equal(self.createValue._id);
          expect(image.status).to.equal(eImageStatus.inProgress);
          expect(self.createStub.calledOnce).to.equal(true);
          expect(self.createStub.args[0][0]).to.exist;
          expect(self.createStub.args[0][0].source).to.equal(legalMessageBody.data.source);
          expect(self.createStub.args[0][0].requestMetadata).to.deep.equal(legalMessageBody.metadata);
          // TODO: patch - no async task when creating image
          //expect(self.createStub.args[0][0].status).to.equal(eImageStatus.waitingTask);
          expect(self.createStub.args[0][0].status).to.equal(eImageStatus.inProgress);
          expect(self.createStub.args[0][0].nextTask).to.not.exist;
          expect(self.createStub.args[0][0].imaginaryIdOriginal).to.equal(self.createValue.imaginaryId);
          expect(self.imaginaryGetInfoConvertedStub.notCalled).to.equal(true);
          expect(self.configConsiderExistingEntityStub.notCalled).to.equal(true);
          //expect(self.configConsiderExistingEntityStub.getCall(0).args[0]).to.equal(self.createValue.entityId);
          done();
        })
        .catch(done);
    });

    it("should return ImageModel instance if succeeded creating new image with skip crop", (done) => {
      self.getIsImageFileValue = true;
      self.createValue = _.cloneDeep(ModelFactory.imageInProgress1);
      self.createValue._id = ModelFactory.objectId1;

      let legalMessageBody = {
        metadata: {
          workloadId: self.createValue.requestMetadata.workloadId,
          reportId: self.createValue.requestMetadata.reportId,
          companyId: self.createValue.requestMetadata.companyId,
          transactionId: self.createValue.requestMetadata.transactionId,
          version: self.createValue.requestMetadata.version,
        },
        data: {
          imageId: self.createValue.imaginaryId, // imaginaryId is the property name in db,
          entityId: self.createValue.entityId,
          tags: self.createValue.tags,
          source: self.createValue.source,
          reportId: self.createValue.reportId,
          skipCrop: true
        }
      };

      ImageService.create(Deserializer.fromMessageBody(JSON.stringify(legalMessageBody)))
        .then((image) => {
          expect(image).to.exist;
          expect(image.id).to.equal(self.createValue._id);
          expect(image.status).to.equal(eImageStatus.inProgress);
          expect(self.createStub.calledOnce).to.equal(true);
          expect(self.createStub.args[0][0]).to.exist;
          expect(self.createStub.args[0][0].source).to.equal(legalMessageBody.data.source);
          expect(self.createStub.args[0][0].requestMetadata).to.deep.equal(legalMessageBody.metadata);
          expect(self.createStub.args[0][0].status).to.equal(eImageStatus.waitingTask);
          expect(self.createStub.args[0][0].nextTask).to.exist;
          expect(self.createStub.args[0][0].nextTask.task).to.equal(eImageTask.processComplete);
          expect(self.createStub.args[0][0].imaginaryIdOriginal).to.equal(self.createValue.imaginaryId);
          expect(self.imaginaryGetInfoConvertedStub.notCalled).to.equal(true);
          expect(self.configConsiderExistingEntityStub.notCalled).to.equal(true);
          //expect(self.configConsiderExistingEntityStub.getCall(0).args[0]).to.equal(self.createValue.entityId);
          done();
        })
        .catch(done);
    });

    it("should reject when ImageModel.create() is rejecting", (done) => {
      self.createValue = _.cloneDeep(ModelFactory.imageInProgress1);
      self.createValue._id = ModelFactory.objectId1;

      let legalMessageBody = {
        metadata: {
          workloadId: self.createValue.requestMetadata.workloadId,
          reportId: self.createValue.requestMetadata.reportId,
          companyId: self.createValue.requestMetadata.companyId,
          transactionId: self.createValue.requestMetadata.transactionId
        },
        data: {
          imageId: self.createValue.imaginaryId, // imaginaryId is the property name in db,
          entityId: self.createValue.entityId,
          tags: self.createValue.tags,
          source: self.createValue.source,
          reportId: self.createValue.reportId
        }
      };

      // no imaginary call should be made
      self.getInfoValue = null;

      self.createStub.restore();
      self.createStub = sinon.stub(ImageModel, "create").callsFake((image) => {
        return Promise.reject("ERROR!")
      });

      ImageService.create(Deserializer.fromMessageBody(JSON.stringify(legalMessageBody)))
        .catch((err) => {
          expect(err).to.exist.and.equal("ERROR!");
          done();
        })
        .catch(done);
    });

    it("should return null when supplying null param", (done) => {
      ImageService.create(null)
        .then((image) => {
          expect(image).to.not.exist;
          expect(self.createStub.callCount).to.equal(0);
          expect(self.imaginaryGetInfoConvertedStub.callCount).to.equal(0);
          expect(self.configConsiderExistingEntityStub.notCalled).to.equal(true);
          done();
        })
        .catch(done);
    });
  });

  describe(".initModel", () => {
    let self = this;

    beforeEach(() => {
      self.imaginaryGetInfoStub = sinon.stub(ImaginaryService, "getInfo").callsFake(() => {
        return Promise.resolve({})
      });
      self.imaginaryIsImageTypeStub = sinon.stub(ImaginaryService, "isImageType").callsFake(() => {
        return self.getIsImageFileValue
      });

      self.imaginaryIsMultiPageTypeStub = sinon.stub(ImaginaryService, "isMultiPageType").callsFake(() => {
        return self.getIsMultiPageTypeValue
      });

      self.deserializerSkipMultiPageStub = sinon.stub(Deserializer, "skipMultiPage").callsFake(() => {
        return Promise.resolve(self.skipCropValue)
      });

      self.deserializerSkipCropStub = sinon.stub(Deserializer, "skipCrop").callsFake(() => {
        return Promise.resolve(self.skipCropValue)
      });
    });

    afterEach(() => {
      self.imaginaryGetInfoStub.restore();
      self.imaginaryIsImageTypeStub.restore();
      self.imaginaryIsMultiPageTypeStub && self.imaginaryIsMultiPageTypeStub.restore()
      self.deserializerSkipMultiPageStub && self.deserializerSkipMultiPageStub.restore()
      self.deserializerSkipCropStub && self.deserializerSkipCropStub.restore();
      self.imaginaryGetInfoStub && self.imaginaryGetInfoStub.restore();
    });


    it("should resolve with 'skip crop' initialized image model when request requestedSkipCrop=true and imaginaryId file is an image type", (done) => {
      self.getIsImageFileValue = true;
      self.skipCropValue = {};

      let requestMessageBody = {
        imageId: "imageId",
        entityId: "entityId",
        source: "test",
        reportId: "reportId",
        requestedSkipCrop: true,
        metadata: {}
      };

      ImageService.initModel(requestMessageBody)
        .then((image) => {
          expect(image).to.exist.and.equal(self.skipCropValue);
          expect(self.imaginaryIsImageTypeStub.calledOnce).to.equal(true);
          expect(self.deserializerSkipCropStub.calledOnce).to.equal(true);
          done();
        })
        .catch(done);
    });

    it("should resolve with 'skip crop' initialized image model when request requestedSkipCrop=true and imaginaryId file is pdf type with max 3 pages", (done) => {
      self.getIsMultiPageTypeValue = true
      self.getIsImageFileValue = false
      self.skipCropValue = {};

      self.imaginaryGetInfoStub.restore()
      self.imaginaryGetInfoStub = sinon.stub(ImaginaryService, "getInfo").callsFake(() => {
        return Promise.resolve({
          metaData: {
            numberOfPages: 2
          }
        })
      });

      let requestMessageBody = {
        imageId: "imageId",
        entityId: "entityId",
        source: "test",
        reportId: "reportId",
        requestedSkipCrop: true,
        metadata: {}
      };

      ImageService.initModel(requestMessageBody)
        .then(() => {
          expect(self.imaginaryGetInfoStub.calledOnce).to.equal(true);
          expect(self.imaginaryIsMultiPageTypeStub.calledOnce).to.equal(true);
          expect(self.deserializerSkipMultiPageStub.calledOnce).to.equal(true);
          expect(self.imaginaryIsImageTypeStub.notCalled).to.equal(true);
          expect(self.deserializerSkipCropStub.notCalled).to.equal(true);
          done();
        })
        .catch(done);
    });

    it(`should not call to Deserializer.skipMultiPage when request skipCrop=true and imaginaryId file is pdf type with more then ${NUMBER_OF_PAGES} pages`, (done) => {
      self.getIsMultiPageTypeValue = true
      self.getIsImageFileValue = false
      self.skipCropValue = {};

      self.imaginaryGetInfoStub.restore()
      self.imaginaryGetInfoStub = sinon.stub(ImaginaryService, "getInfo").callsFake(() => {
        return Promise.resolve({
          metaData: {
            numberOfPages: NUMBER_OF_PAGES + 1
          }
        })
      });

      let requestMessageBody = {
        imageId: "imageId",
        entityId: "entityId",
        source: "test",
        reportId: "reportId",
        requestedSkipCrop: true,
        metadata: {}
      };

      ImageService.initModel(requestMessageBody)
        .then(() => {

          expect(self.imaginaryGetInfoStub.calledOnce).to.equal(true);
          expect(self.imaginaryIsMultiPageTypeStub.calledOnce).to.equal(true);
          expect(self.deserializerSkipMultiPageStub.notCalled).to.equal(true);
          expect(self.imaginaryIsImageTypeStub.calledOnce).to.equal(true);
          expect(self.deserializerSkipCropStub.notCalled).to.equal(true);
          done();
        })
        .catch(done);
    });

    it("should resolve with initialized image model when request skipCrop=false", (done) => {

      let requestMessageBody = {
        imageId: "imageId",
        entityId: "entityId",
        source: "test",
        reportId: "reportId",
        requestedSkipCrop: false,
        metadata: {}
      };

      ImageService.initModel(requestMessageBody)
        .then((image) => {
          expect(image).to.exist;
          expect(self.imaginaryIsImageTypeStub.notCalled).to.equal(true);
          expect(self.deserializerSkipCropStub.notCalled).to.equal(true);
          done();
        })
        .catch(done);
    });

    it("should resolve image with copied crop areas if imaginaryId already exist", (done) => {
      const imaginaryIdOriginal = "imageId"
      self.existingImage = _.cloneDeep(ModelFactory.imageInProgress1);
      self.existingImage.status = eImageStatus.done;
      self.existingImage.imaginaryIdOriginal = imaginaryIdOriginal
      self.existingImage.cropAreas = [ModelFactory.cropAreaRequestBody1]
      self.findLastIfExistImageServiceStub = sinon.stub(ImageService, "findLastIfExist").callsFake((image) => {
        return Promise.resolve(new ImageModel(self.existingImage))
      });

      let requestMessageBody = {
        imageId: imaginaryIdOriginal,
        entityId: "entityId",
        source: "test",
        reportId: "reportId",
        requestedSkipCrop: false,
        metadata: {}
      };

      ImageService.initModel(requestMessageBody)
        .then((image) => {
          expect(image).to.exist;
          expect(self.findLastIfExistImageServiceStub.calledOnce).to.equal(true);
          expect(image.nextTask).to.exist;
          expect(image.nextTask.task).to.exist;
          expect(image.nextTask.task).to.equal(eImageTask.processComplete);
          expect(image.status).to.equal(eImageStatus.waitingTask);
          self.findLastIfExistImageServiceStub.restore()
          done();

        })
        .catch(() => {
          self.findLastIfExistImageServiceStub.restore()
          done()
        });
    });

    it("should cancel crop skipping when imaginary info response with error", (done) => {

      self.getIsImageFileValue = true;
      self.skipCropValue = {};

      self.imaginaryGetInfoStub.restore();
      self.imaginaryGetInfoStub = sinon.stub(ImaginaryService, "getInfo").callsFake(() => {
        return Promise.reject("ERROR!")
      });

      let requestMessageBody = {
        imageId: "imageId",
        entityId: "entityId",
        source: "test",
        reportId: "reportId",
        requestedSkipCrop: true,
        metadata: {}
      };

      ImageService.initModel(requestMessageBody)
        .then((image) => {
          expect(image).to.exist;
          expect(self.imaginaryGetInfoStub.calledOnce).to.equal(true);
          expect(self.imaginaryIsImageTypeStub.notCalled).to.equal(true);
          expect(self.deserializerSkipCropStub.notCalled).to.equal(true);
          done();
        })
        .catch(done);
    });
  })

  describe(".createHandler", () => {
    let self = this;

    beforeEach((done) => {
      DBService.clearDB()
      .then(() => {
        self.createImageControllerStub = sinon.stub(ImageService, "create").callsFake((image) => {
          return Promise.resolve(new ImageModel(self.createValue))
        });
      })
      .then(() => done());
    });

    afterEach(() => {
      self.createImageControllerStub.restore();
    });

    it("should return ImageModel instance if succeeded creating new image", (done) => {
      self.createValue = _.cloneDeep(ModelFactory.imageInProgress1);
      self.createValue._id = ModelFactory.objectId1;

      let legalMessageBody = {
        metadata: {
          workloadId: self.createValue.requestMetadata.workloadId,
          reportId: self.createValue.requestMetadata.reportId,
          companyId: self.createValue.requestMetadata.companyId,
          transactionId: self.createValue.requestMetadata.transactionId
        },
        data: {
          imageId: self.createValue.imaginaryId, // imaginaryId is the property name in db,
          entityId: self.createValue.entityId,
          tags: self.createValue.tags,
          source: self.createValue.source,
          reportId: self.createValue.reportId
        }
      };

      let msgBodyStr = {messageId: "messageId1", receiptHandle: "receiptHandle1", body: JSON.stringify(legalMessageBody)};

      ImageService.createHandler(msgBodyStr)
        .then((retValue) => {
          expect(retValue).to.not.exist;
          expect(self.createImageControllerStub.calledOnce).to.equal(true);
          expect(self.createImageControllerStub.getCall(0).args[0]).to.exist;
          // just checking deserializer did its job
          expect(self.createImageControllerStub.getCall(0).args[0].imageId).to.equal(legalMessageBody.data.imageId);

          done();
        })
        .catch(done);
    });

    it("should reject if message.body could not be parsed", (done) => {
      self.createValue = _.cloneDeep(ModelFactory.imageInProgress1);
      self.createValue._id = ModelFactory.objectId1;

      let illegalMessageBody = {
        imageId: self.createValue.imaginaryId
      };

      let msgBodyStr = {messageId: "messageId1", receiptHandle: "receiptHandle1", body: JSON.stringify(illegalMessageBody)};

      ImageService.createHandler(msgBodyStr)
        .catch((retValue) => {
          expect(retValue).to.exist; // the reject message
          expect(self.createImageControllerStub.notCalled).to.equal(true);
          done();
        })
        .catch(done);
    });

    it("should reject if ImageService.create was rejected", (done) => {
      self.createImageControllerStub.restore(); // this test need it to reject
      self.createValue = _.cloneDeep(ModelFactory.imageInProgress1);

      self.createImageControllerStub = sinon.stub(ImageService, "create").callsFake((image) => {
        return Promise.reject("Err")
      });

      let legalMessageBody = {
        metadata: {
          workloadId: self.createValue.requestMetadata.workloadId,
          reportId: self.createValue.requestMetadata.reportId,
          companyId: self.createValue.requestMetadata.companyId,
          transactionId: self.createValue.requestMetadata.transactionId
        },
        data: {
          imageId: self.createValue.imaginaryId, // imaginaryId is the property name in db,
          entityId: self.createValue.entityId,
          tags: self.createValue.tags,
          source: self.createValue.source,
          reportId: self.createValue.reportId
        }
      };


      let msgBodyStr = {messageId: "messageId1", receiptHandle: "receiptHandle1", body: JSON.stringify(legalMessageBody)};

      ImageService.createHandler(msgBodyStr)
        .catch((retValue) => {
          expect(retValue).to.exist; // the reject message
          expect(self.createImageControllerStub.calledOnce).to.equal(true);
          done();
        })
        .catch(done);
    });
  })

  describe("should force image proccess", () => {
    let self = this;

    beforeEach((done) => {
      DBService.clearDB()
      .then(() => UserModel.createUser(ModelFactory.userWithInhouseTag))
      .then((user) => {
        self.userWithInhouseTag = user;
      })
      done();
    });

    it("should save image with forced as true", (done) => {
      self.createValue = _.cloneDeep(ModelFactory.imageInProgress1);
      self.createValue._id = ModelFactory.objectId1;

      let legalMessageBody = {
        metadata: {
          workloadId: self.createValue.requestMetadata.workloadId,
          reportId: self.createValue.requestMetadata.reportId,
          companyId: self.createValue.requestMetadata.companyId,
          transactionId: self.createValue.requestMetadata.transactionId
        },
        data: {
          imageId: self.createValue.imaginaryId, // imaginaryId is the property name in db,
          entityId: self.createValue.entityId,
          tags: self.createValue.tags,
          source: self.createValue.source,
          reportId: self.createValue.reportId,
          skipCrop: false,
          force: true
        }
      };

      ImageService
        .create(Deserializer.fromMessageBody(JSON.stringify(legalMessageBody)))
        .then((image) => self.image = image)
        .then(() => ImageModel.findById(self.image.id))
        .then((image) => {
          expect(image).to.exist;
          expect(image.forced).to.equal(true);
          done();
        })
        .catch(done)

    })
  });

  describe("duplicate images", () => {
    let self = this;

    self.initSpyAndStub = () => {
      self.req = {
        query: {},
        params: {},
        body: {
          user: { model: {}}
        },
        header: (status) => {}
      };

      self.res = {
        status: (status) => {
          self.statusSpy(status);
          return {
            json: (obj) => {
              self.jsonSpy(obj);
              return obj
            },
            send: (body) => {
              self.sendSpy(body);
              return body
            }
          }
        }
      };

      self.imaginaryIsImageTypeStub = sinon.stub(ImaginaryService, "isImageFile").callsFake(() => {
        return Promise.resolve(true);
      });
    };

    beforeEach((done) => {
      DBService.clearDB()
      .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
      .then((user) => {
        self.user = user;
        self.initSpyAndStub()
      });
      done();
    });

    afterEach(() => {
      // reset for other tests
      self.imaginaryIsImageTypeStub.restore();
    });

    it("should save image with the same crop data if duplicate", (done) => {
      self.createValue = _.cloneDeep(ModelFactory.imageInProgress1);
      self.createValue._id = ModelFactory.objectId1;

      let legalMessageBody = {
        metadata: {
          workloadId: self.createValue.requestMetadata.workloadId,
          reportId: self.createValue.requestMetadata.reportId,
          companyId: self.createValue.requestMetadata.companyId,
          transactionId: self.createValue.requestMetadata.transactionId
        },
        data: {
          imageId: self.createValue.imaginaryId, // imaginaryId is the property name in db,
          entityId: self.createValue.entityId,
          tags: self.createValue.tags,
          source: self.createValue.source,
          reportId: self.createValue.reportId,
          skipCrop: false
        }
      };

      let legalMessageBody2 = _.cloneDeep(legalMessageBody)
      legalMessageBody2.metadata.transactionId = 'transactionId2';

      ImageService
        .create(Deserializer.fromMessageBody(JSON.stringify(legalMessageBody)))
        .then((image) => ImageModel.findById(image.id))
        .then(image => self.originImage = image)
        .then(() => ImageService.createCropArea(self.originImage.id, self.user, ModelFactory.cropAreaRequestBody1))
        .then(() => ImageModel.updateStatus(self.originImage, self.user.id, eImageStatus.done, "done image", "xxx"))
        .then(() => ImageService.create(Deserializer.fromMessageBody(JSON.stringify(legalMessageBody2))))
        .then((image) => ImageModel.findById(image.id))
        .then((image) => {
          expect(image).to.exist;
          expect(self.originImage).to.exist;
          expect(self.originImage.status).to.equal(eImageStatus.done);

          var originCropAreas = self.originImage.cropAreas[0]
          var copiedCropAreas = image.cropAreas[0]

          expect(self.originImage.cropAreas.length).to.equal(image.cropAreas.length);
          expect(originCropAreas.status).to.equal(copiedCropAreas.status);
          expect(originCropAreas.x).to.equal(copiedCropAreas.x);
          expect(originCropAreas.y).to.equal(copiedCropAreas.y);
          expect(originCropAreas.width).to.equal(copiedCropAreas.width);
          expect(originCropAreas.height).to.equal(copiedCropAreas.height);
          expect(originCropAreas.updatedAt).to.not.equal(copiedCropAreas.updatedAt);
          expect(copiedCropAreas.updatedAt).to.not.exist;
          expect(copiedCropAreas.createdByUserId).to.not.exist;

          done();
        })
        .catch(done)

    });

    it('should save image with the same crop data coordinates if duplicate and need to recalc', (done) => {
      self.createValue = _.cloneDeep(ModelFactory.imageInProgress1);
      self.createValue._id = ModelFactory.objectId1;

      let legalMessageBody = {
        metadata: {
          workloadId: self.createValue.requestMetadata.workloadId,
          reportId: self.createValue.requestMetadata.reportId,
          companyId: self.createValue.requestMetadata.companyId,
          transactionId: self.createValue.requestMetadata.transactionId
        },
        data: {
          imageId: self.createValue.imaginaryId, // imaginaryId is the property name in db,
          entityId: self.createValue.entityId,
          tags: self.createValue.tags,
          source: self.createValue.source,
          reportId: self.createValue.reportId,
          reCalc: undefined
        }
      };

      let legalMessageBody2 = _.cloneDeep(legalMessageBody)
      legalMessageBody2.metadata.transactionId = 'transactionId2';
      legalMessageBody2.data.reCalc = true;

      ImageService
        .create(Deserializer.fromMessageBody(JSON.stringify(legalMessageBody)))
        .then((image) => ImageModel.findById(image.id))
        .then(image => self.originImage = image)
        .then(() => ImageService.createCropArea(self.originImage.id, self.user, ModelFactory.cropAreaRequestBody1))
        .then(() => ImageModel.updateStatus(self.originImage, self.user.id, eImageStatus.done, "done image", "xxx"))
        .then(() => ImageService.create(Deserializer.fromMessageBody(JSON.stringify(legalMessageBody2))))
        .then((image) => ImageModel.findById(image.id))
        .then((image) => {
          expect(image).to.exist;
          expect(self.originImage).to.exist;
          expect(self.originImage.status).to.equal(eImageStatus.done);
          expect(image.status).to.equal(eImageStatus.waitingTask);

          var originCropAreas = self.originImage.cropAreas[0]
          var copiedCropAreas = image.cropAreas[0]

          expect(self.originImage.cropAreas.length).to.equal(image.cropAreas.length);
          expect(originCropAreas.status).to.equal(copiedCropAreas.status);
          expect(originCropAreas.x).to.equal(copiedCropAreas.x);
          expect(originCropAreas.y).to.equal(copiedCropAreas.y);
          expect(originCropAreas.width).to.equal(copiedCropAreas.width);
          expect(originCropAreas.height).to.equal(copiedCropAreas.height);
          expect(copiedCropAreas.imaginaryId).to.not.exist;
          expect(copiedCropAreas.cloudinary).to.not.have.keys;
          expect(copiedCropAreas.updatedAt).to.not.exist;
          expect(copiedCropAreas.createdByUserId).to.not.exist;

          done();
        })
        .catch(done)
    });

    it('should save an new image with old data if got recalc indication but it was a single image', (done) => {
      self.createValue = _.cloneDeep(ModelFactory.imageInProgress1);
      self.createValue._id = ModelFactory.objectId1;

      let legalMessageBody = {
        metadata: {
          workloadId: self.createValue.requestMetadata.workloadId,
          reportId: self.createValue.requestMetadata.reportId,
          companyId: self.createValue.requestMetadata.companyId,
          transactionId: self.createValue.requestMetadata.transactionId
        },
        data: {
          imageId: self.createValue.imaginaryId, // imaginaryId is the property name in db,
          entityId: self.createValue.entityId,
          tags: self.createValue.tags,
          source: self.createValue.source,
          reportId: self.createValue.reportId,
          reCalc: undefined
        }
      };

      let legalMessageBody2 = _.cloneDeep(legalMessageBody)
      legalMessageBody2.metadata.transactionId = 'transactionId2';
      legalMessageBody2.data.reCalc = true;

      ImageService
        .create(Deserializer.fromMessageBody(JSON.stringify(legalMessageBody)))
        .then(() => ImageService.next(self.user))
        .then((image) => self.originImage = image)
        .then(() => ImageService.completeAsSingleImage(self.originImage, self.user))
        .then(() => ImageModel.updateStatus(self.originImage, self.user.id, eImageStatus.done, "done image", "xxx"))
        .then(() => ImageService.create(Deserializer.fromMessageBody(JSON.stringify(legalMessageBody2))))
        .then((image) => ImageModel.findById(image.id))
        .then((image) => {
          expect(image).to.exist;
          expect(self.originImage).to.exist;
          expect(self.originImage.status).to.equal(eImageStatus.done);
          expect(image.status).to.equal(eImageStatus.waitingTask);
          expect(image.requestedSkipCrop).to.equal(false);
          expect(image.skippedCrop).to.equal(true);

          var originCropAreas = self.originImage.cropAreas[0]
          var copiedCropAreas = image.cropAreas[0]

          expect(self.originImage.requestedSkipCrop).to.equal(false);
          expect(self.originImage.skippedCrop).to.equal(false);
          expect(self.originImage.cropAreas.length).to.equal(image.cropAreas.length);
          expect(originCropAreas.status).to.equal(copiedCropAreas.status);
          expect(copiedCropAreas.imaginaryId).to.equal(originCropAreas.imaginaryId);
          expect(copiedCropAreas.updatedAt).to.not.exist;
          expect(copiedCropAreas.createdByUserId).to.not.exist;
          done();
        })
        .catch(done)
    });

    it('should save an new image with multiTask if skipped on mutlipage', function (done) {

      self.createValue = _.cloneDeep(ModelFactory.imageInProgress1);
      self.createValue._id = ModelFactory.objectId1;

      self.imaginaryGetInfoStub = sinon.stub(ImaginaryService, "getInfo").callsFake(() => {
        return Promise.resolve({
          metaData: {
            numberOfPages: 1
          }
        });
      });
      self.imaginaryIsMultiPageStub = sinon.stub(ImaginaryService, "isMultiPageType").callsFake(() => {
        return Promise.resolve(true);
      });


      let legalMessageBody = {
        metadata: {
          workloadId: self.createValue.requestMetadata.workloadId,
          reportId: self.createValue.requestMetadata.reportId,
          companyId: self.createValue.requestMetadata.companyId,
          transactionId: self.createValue.requestMetadata.transactionId
        },
        data: {
          imageId: self.createValue.imaginaryId, // imaginaryId is the property name in db,
          entityId: self.createValue.entityId,
          tags: self.createValue.tags,
          source: self.createValue.source,
          reportId: self.createValue.reportId,
          skipCrop: true,
          reCalc: undefined
        }
      };

      let legalMessageBody2 = _.cloneDeep(legalMessageBody);
      legalMessageBody2.metadata.transactionId = 'transactionId2';
      legalMessageBody2.data.reCalc = true;
      legalMessageBody2.data.skipCrop = undefined;

      ImageService
        .create(Deserializer.fromMessageBody(JSON.stringify(legalMessageBody)))
        .then((image) => ImageModel.findById(image.id))
        .then((image) => self.originImage = image)
        .then(() => ImageModel.updateCropAreaImage(self.originImage, "12345", "12345", "3135234"))
        .then(() => ImageModel.updateStatus(self.originImage, self.user.id, eImageStatus.done, "done image", "xxx"))
        .then(() => ImageService.create(Deserializer.fromMessageBody(JSON.stringify(legalMessageBody2))))
        .then((image) => ImageModel.findById(image.id))
        .then((image) => {
          expect(image).to.exist;
          expect(self.originImage).to.exist;
          expect(self.originImage.status).to.equal(eImageStatus.done);
          expect(image.status).to.equal(eImageStatus.waitingTask);
          expect(image.requestedSkipCrop).to.equal(false);
          expect(image.skippedCrop).to.equal(true);

          var originCropAreas = self.originImage.cropAreas[0];
          var copiedCropAreas = image.cropAreas[0];

          expect(self.originImage.cropAreas.length).to.equal(image.cropAreas.length);
          expect(originCropAreas.status).to.equal(copiedCropAreas.status);
          expect(copiedCropAreas.imaginaryId).to.not.exist;
          expect(copiedCropAreas.updatedAt).to.not.exist;
          expect(copiedCropAreas.createdByUserId).to.not.exist;

          self.imaginaryGetInfoStub.restore();
          self.imaginaryIsMultiPageStub.restore();
          done();
        })
        .catch(done)
    });

  });

  describe(".validateSkipRequest", () => {
    let self = this;

    beforeEach(() => {
      self.imaginaryGetInfoStub = sinon.stub(ImaginaryService, "getInfo").callsFake(() => {
        return Promise.resolve({})
      });
      self.imaginaryIsMultiPageTypeStub = sinon.stub(ImaginaryService, "isMultiPageType").callsFake(() => false);
      self.deserializerSkipMultiPageStub = sinon.stub(Deserializer, "skipMultiPage").callsFake(() => {
        return Promise.resolve(self.skipCropValue)
      });
      self.imaginaryIsImageTypeStub = sinon.stub(ImaginaryService, "isImageType").callsFake(() => self.getIsImageFileValue);
      self.deserializerSkipCropStub = sinon.stub(Deserializer, "skipCrop").callsFake(() => {
        return Promise.resolve(self.skipCropValue)
      });
    });

    afterEach(() => {
      self.imaginaryGetInfoStub.restore();
      self.imaginaryIsMultiPageTypeStub.restore();
      self.deserializerSkipMultiPageStub.restore();
      self.imaginaryIsImageTypeStub.restore();
      self.deserializerSkipCropStub.restore();
    });

    it('should resolve reqToSkip object with properties {isValid: true, reason: multiPages} if called internally.', (done) => {
      self.skipCropValue = {};
      self.imaginaryGetInfoStub.restore();
      self.imaginaryGetInfoStub = sinon.stub(ImaginaryService, "getInfo").callsFake(() => {
        return Promise.resolve({
          metaData: {
            numberOfPages: 2
          }
        })
      });
      self.imaginaryIsMultiPageTypeStub.restore();
      self.imaginaryIsMultiPageTypeStub = sinon.stub(ImaginaryService, "isMultiPageType").callsFake(() => true);
      let internalCall = true;
      let imgObj = {
        imageId: "imageId",
        entityId: "entityId",
        source: "test",
        reportId: "reportId",
        imaginaryIdOriginal: "imaginaryIdOriginal",
        requestedSkipCrop: true,
        metadata: {}
      };

      ImageService.validateSkipRequest(imgObj, internalCall)
        .then((reqToSkip) => {
          expect(reqToSkip).to.exist;
          expect(reqToSkip.isValid).to.equal(true);
          expect(reqToSkip.reason).to.equal('multiPages');
          expect(self.imaginaryGetInfoStub.calledOnce).to.equal(true);
          expect(self.imaginaryIsMultiPageTypeStub.calledOnce).to.equal(true);
          expect(self.deserializerSkipMultiPageStub.notCalled).to.equal(true);
          done();
        })
        .catch(done);
    })

    it('should resolve reqToSkip object with properties {isValid: true, reason: image} if called internally.', (done) => {
      self.getIsImageFileValue = true;
      self.skipCropValue = {};
      self.imaginaryGetInfoStub.restore();
      self.imaginaryGetInfoStub = sinon.stub(ImaginaryService, "getInfo").callsFake(() => {
        return Promise.resolve(true);
      });
      self.imaginaryIsImageTypeStub.restore();
      self.imaginaryIsImageTypeStub = sinon.stub(ImaginaryService, "isImageType").callsFake(() => self.getIsImageFileValue);

      let internalCall = true;
      let imgObj = {
        imageId: "imageId",
        entityId: "entityId",
        source: "test",
        reportId: "reportId",
        imaginaryIdOriginal: "imaginaryIdOriginal",
        requestedSkipCrop: true,
        metadata: {}
      };

      ImageService.validateSkipRequest(imgObj, internalCall)
        .then((reqToSkip) => {
          expect(reqToSkip).to.exist;
          expect(reqToSkip.isValid).to.equal(true);
          expect(reqToSkip.reason).to.equal('image');
          expect(self.imaginaryGetInfoStub.calledOnce).to.equal(true);
          expect(self.imaginaryIsImageTypeStub.calledOnce).to.equal(true);
          expect(self.deserializerSkipCropStub.notCalled).to.equal(true);
          done();
        })
        .catch(done);
    })

    it('should resolve image object thru Deserializer.skipMultiPage if called externally.', (done) => {
      self.getIsImageFileValue = true;
      self.skipCropValue = {};
      self.imaginaryGetInfoStub.restore();
      self.imaginaryGetInfoStub = sinon.stub(ImaginaryService, "getInfo").callsFake(() => {
        return Promise.resolve({
          metaData: {
            numberOfPages: 2
          }
        })
      });
      self.imaginaryIsMultiPageTypeStub.restore();
      self.imaginaryIsMultiPageTypeStub = sinon.stub(ImaginaryService, "isMultiPageType").callsFake(() => true);

      let imgObj = {
        imageId: "imageId",
        entityId: "entityId",
        source: "test",
        reportId: "reportId",
        requestedSkipCrop: true,
        metadata: {}
      };

      ImageService.validateSkipRequest(imgObj)
        .then((image) => {
          expect(image).to.exist;
          expect(self.imaginaryGetInfoStub.calledOnce).to.equal(true);
          expect(self.imaginaryIsMultiPageTypeStub.calledOnce).to.equal(true);
          expect(self.deserializerSkipMultiPageStub.calledOnce).to.equal(true);
          expect(self.imaginaryIsImageTypeStub.notCalled).to.equal(true);
          expect(self.deserializerSkipCropStub.notCalled).to.equal(true);
          done();
        })
        .catch(done);
    })

    it('should resolve image object thru Deserializer.skipCrop if called externally.', (done) => {
      self.getIsImageFileValue = true;
      self.skipCropValue = {};
      self.imaginaryGetInfoStub.restore();
      self.imaginaryGetInfoStub = sinon.stub(ImaginaryService, "getInfo").callsFake(() => {
        return Promise.resolve(true)
      });
      self.imaginaryIsMultiPageTypeStub.restore();
      self.imaginaryIsMultiPageTypeStub = sinon.stub(ImaginaryService, "isMultiPageType").callsFake(() => false);
      self.imaginaryIsImageTypeStub.restore();
      self.imaginaryIsImageTypeStub = sinon.stub(ImaginaryService, "isImageType").callsFake(() => self.getIsImageFileValue);

      let imgObj = {
        imageId: "imageId",
        entityId: "entityId",
        source: "test",
        reportId: "reportId",
        requestedSkipCrop: true,
        metadata: {}
      };

      ImageService.validateSkipRequest(imgObj)
        .then((image) => {
          expect(image).to.exist;
          expect(self.imaginaryGetInfoStub.calledOnce).to.equal(true);
          expect(self.imaginaryIsImageTypeStub.calledOnce).to.equal(true);
          expect(self.deserializerSkipCropStub.calledOnce).to.equal(true);
          done();
        })
        .catch(done);
    })

  });

});
