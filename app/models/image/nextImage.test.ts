import ImageModel from './image.model';
import {IImageFetcher} from "./image.model";
import UserModel from '../user/user.model';
import * as ModelFactory from '../../helpers/tests/modelFactory'
import {eImageStatus} from "./image.model.interface";
import {IImageModel} from "./image.model.interface";
import {NextImage} from "./nextImage";
import BaseTest from '../../helpers/tests/base';
const mongoose = require('mongoose');
import * as sinon from 'sinon';
const {expect} = require('chai');
import ConfigModel from "../config/config.model";
import { DBService } from '../../services/dbService';

describe('NextImage', () => {
  before((done) => {
    DBService.clearDB().then(done);
  });

  after((done) => {
    DBService.clearDB().then(done);
  });

  describe('#fetch', () => {
    let userWithoutTagsDoc;
    let self  = this;

    beforeEach((done) => {
      DBService.clearDB()
      .then(() => ImageModel.create(ModelFactory.imageInProgress1))
      .then(() => ImageModel.create(ModelFactory.imageInProgressA))
      .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
      .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
      .then((user) => { self.userWithoutTagsDoc = user } )
      .then(() => { done() })
      .catch(done);
    });

    afterEach(done => {
      DBService.clearDB()
      .then(done);
    })

    self._updateImageActiveUser = (imageToUpdate: IImageModel, updatedAt: Date, createdAt: Date, userId: string): Promise<ImageModel> => {
      return new Promise((resolve, reject) => {
        return ImageModel.mongoose.findOne({_id: imageToUpdate.id}).exec()
        .then((image) => {
          image.updatedAt = updatedAt;
          image.createdAt = createdAt;
          image.activeUser = userId;
          image.save();
          resolve(new ImageModel(image));
        })
        .catch(err => {
          reject(err)
        });
      });
    };

    self._updateTags = (imageToUpdate: ImageModel, userToUpdate: UserModel, userTags: string[], imageTags: string[]): Promise<boolean> => {
      return new Promise((resolve:Function, reject:Function) => {
        return ImageModel.mongoose.findOne({_id: imageToUpdate.id}).exec()
        .then((image) => {
          image.tags = imageTags;
          return image.save();
        })
        .then(() => {
          return UserModel.mongoose.findOne({_id: userToUpdate.id}).exec()
          .then((user) => {
            user.tags = userTags;
            user.save();
            resolve(true);
          })
        })
        .catch(err => {
          reject(err)
        });
      });
    };

    it('should return image when user and image have no tags', (done) => {
      let itSelf: any = {};
      let fetcher: IImageFetcher = new NextImage(self.userWithoutTagsDoc.id);

      let _onSuccess = (image: ImageModel) => {
        expect(image).to.exist;
        expect(image.id).to.equal(itSelf.image.id);
        expect(image).to.have.property('updatedAt');
        expect(image).to.have.property('tsSubmitted');
        expect(image).to.have.property('activeUser').and.to.equal(self.userWithoutTagsDoc.id);
        expect(image).to.have.property('status').and.to.equal(eImageStatus.inProgress);
        done();
      };

      Promise.resolve(mongoose.model("Image").remove({}))
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => itSelf.image = image)
        .then(() => self._updateTags(itSelf.image, self.userWithoutTagsDoc, [], []))
        .then(() => fetcher.fetch())
        .then(_onSuccess)
        .catch(done);
    });

    it('should return image when user and image have one tag exactly and it is match', (done) => {
      let itSelf: any = {};
      let fetcher: IImageFetcher = new NextImage(self.userWithoutTagsDoc.id, ["tag1"]);

      let _onSuccess = (image: ImageModel) => {
        expect(image).to.exist;
        expect(image.id).to.equal(itSelf.image.id);
        expect(image).to.have.property('updatedAt');
        expect(image).to.have.property('activeUser').and.to.equal(self.userWithoutTagsDoc.id);
        expect(image).to.have.property('status').and.to.equal(eImageStatus.inProgress);
        done();
      };

      Promise.resolve(mongoose.model("Image").remove({}))
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => itSelf.image = image)
        .then(() => self._updateTags(itSelf.image, self.userWithoutTagsDoc, ["tag1"], ["tag1"]))
        .then(() => fetcher.fetch())
        .then(_onSuccess)
        .catch(done);
    });

    it('should NOT return image when user and image have one tag exactly and it is NOT match', (done) => {
      let itSelf: any = {};
      let fetcher: IImageFetcher = new NextImage(self.userWithoutTagsDoc.id, ["tag1"]);

      let _onSuccess = (image: ImageModel) => {
        expect(image).to.not.exist;
        done();
      };

      Promise.resolve(mongoose.model("Image").remove({}))
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => itSelf.image = image)
        .then(() => self._updateTags(itSelf.image, self.userWithoutTagsDoc, ["tag1"], ["tag2"]))
        .then(() => fetcher.fetch())
        .then(_onSuccess)
        .catch(done);
    });

    it('should return image when user and image have multiple tags and all user tags match all image tags', (done) => {
      let itSelf: any = {};
      let fetcher: IImageFetcher = new NextImage(self.userWithoutTagsDoc.id, ["tag1", "tag2"]);

      let _onSuccess = (image: ImageModel) => {
        expect(image).to.exist;
        expect(image.id).to.equal(itSelf.image.id);
        expect(image).to.have.property('updatedAt');
        expect(image).to.have.property('activeUser').and.to.equal(self.userWithoutTagsDoc.id);
        expect(image).to.have.property('status').and.to.equal(eImageStatus.inProgress);
        done();
      };

      Promise.resolve(mongoose.model("Image").remove({}))
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => itSelf.image = image)
        .then(() => self._updateTags(itSelf.image, self.userWithoutTagsDoc, ["tag1", "tag2"], ["tag2", "tag1"]))
        .then(() => fetcher.fetch())
        .then(_onSuccess)
        .catch(done);
    });

    // TODO: maybe better behaviour is when all user tags need to match at least some image tags
    it('should return image when user and image have multiple tags and not all user tags match all image tags', (done) => {
      let itSelf: any = {};
      let fetcher: IImageFetcher = new NextImage(self.userWithoutTagsDoc.id, ["tag1", "tag3"]);

      let _onSuccess = (image: ImageModel) => {
        expect(image).to.exist;
        expect(image.id).to.equal(itSelf.image.id);
        expect(image).to.have.property('updatedAt');
        expect(image).to.have.property('activeUser').and.to.equal(self.userWithoutTagsDoc.id);
        expect(image).to.have.property('status').and.to.equal(eImageStatus.inProgress);
        done();
      };

      Promise.resolve(mongoose.model("Image").remove({}))
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => itSelf.image = image)
        .then(() => self._updateTags(itSelf.image, self.userWithoutTagsDoc, ["tag1", "tag3"], ["tag2", "tag1"]))
        .then(() => fetcher.fetch())
        .then(_onSuccess)
        .catch(done);
    });

    it('should return image when user and image have multiple tags and some user tags match all image tags', (done) => {
      let itSelf: any = {};
      let fetcher: IImageFetcher = new NextImage(self.userWithoutTagsDoc.id, ["tag1", "tag2", "tag3"]);

      let _onSuccess = (image: ImageModel) => {
        expect(image).to.exist;
        expect(image.id).to.equal(itSelf.image.id);
        expect(image).to.have.property('updatedAt');
        expect(image).to.have.property('activeUser').and.to.equal(self.userWithoutTagsDoc.id);
        expect(image).to.have.property('status').and.to.equal(eImageStatus.inProgress);
        done();
      };

      Promise.resolve(mongoose.model("Image").remove({}))
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => itSelf.image = image)
        .then(() => self._updateTags(itSelf.image, self.userWithoutTagsDoc, ["tag1", "tag2", "tag3"], ["tag2", "tag1"]))
        .then(() => fetcher.fetch())
        .then(_onSuccess)
        .catch(done);
    });

    it('should NOT return image if tags cases not matching', (done) => {
      let itSelf: any = {};
      let fetcher: IImageFetcher = new NextImage(self.userWithoutTagsDoc.id, ["TAG1"]);

      let _onSuccess = (image: ImageModel) => {
        expect(image).to.not.exist;
        done();
      };

      Promise.resolve(mongoose.model("Image").remove({}))
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => itSelf.image = image)
        .then(() => self._updateTags(itSelf.image, self.userWithoutTagsDoc, ["TAG1"], ["tag1"]))
        .then(() => fetcher.fetch())
        .then(_onSuccess)
        .catch(done);
    });

    it('should return current progress image of user', function (done) {

      let itSelf: any = {};
      let fetcher: IImageFetcher;

      // createdAt value of older time than now
      itSelf.createdAt = new Date();
      console.log('itSelf.createdAt:', itSelf.createdAt);
      itSelf.createdAt.setMinutes(itSelf.createdAt.getMinutes() - 1);
      console.log('itSelf.createdAt:', itSelf.createdAt);

      const onSuccess = image => {
        expect(image).to.be.exist;
        expect(image.id).to.equal(itSelf.imageInTimeframe.id);
        expect(image.activeUser).to.equal(itSelf.user.id);
        done();
      }

      UserModel.createUser(ModelFactory.userWithoutTags)
      .then((user) => {
        itSelf.user = user;
        fetcher = new NextImage(itSelf.user.id, ModelFactory.imageInProgressA.tags);
      })

      .then(() => ImageModel.create(ModelFactory.imageInProgressA))
      // lock image by user
      .then((image) => {
        console.log('first image.id:', image.id);
        itSelf.imageInTimeframe = image;
        console.log('first image.createdAt:', image.createdAt)
        return self._updateImageActiveUser(image, BaseTest.timeBeforeImageLockBegin, itSelf.createdAt, itSelf.user.id);
      })

      // and another image, but locked on this user
      .then((imageModel) => ImageModel.create(ModelFactory.imageInProgressA))
      .then(() => fetcher.fetch())
      .then(onSuccess)
      .catch(done);
    });

    it('should not return "locked" image of other user while image.updatedAt in timeframe', (done) => {
      let itSelf: any = {};
      let fetcher: IImageFetcher;

      // first image with activeUser should have older createdAt value, because its the query sorting value
      itSelf.firstImageCreatedAt = new Date();
      itSelf.firstImageCreatedAt.setMinutes(itSelf.firstImageCreatedAt.getMinutes() - 1);

      let _onSuccess = () => {
        expect(itSelf.imageOfFirstUser.id).to.not.equal(itSelf.imageOfSecondUser.id);
        expect(itSelf.imageOfFirstUser.activeUser).to.not.equal(itSelf.imageOfSecondUser.activeUser);
        done();
      };

      Promise.resolve(mongoose.model("Image").remove({}))
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => {
          itSelf.secondUser = user;
          fetcher = new NextImage(itSelf.secondUser.id);
        })
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => self._updateImageActiveUser(image, new Date(), itSelf.firstImageCreatedAt, self.userWithoutTagsDoc.id))
        .then((image) => itSelf.imageOfFirstUser = image)
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then(() =>  fetcher.fetch())
        .then((image) => itSelf.imageOfSecondUser = image)
        .then(_onSuccess)
        .catch(done);
    });

    it('should return oldest "inProgress" image, even when have activeUser value, in case updateAt is older than defined timeframe', (done) => {
      let itSelf: any = {};
      let fetcher: IImageFetcher;

      // image with activeUser should have older createdAt value, because its the query sorting value
      itSelf.imageOutOfTimeframeCreatedAt = new Date();
      itSelf.imageOutOfTimeframeCreatedAt.setMinutes(itSelf.imageOutOfTimeframeCreatedAt.getMinutes() - 1);

      let _onSuccess = () => {
        expect(itSelf.nextImage.id).to.equal(itSelf.imageOutOfTimeframe.id);
        expect(itSelf.nextImage.activeUser).to.equal(itSelf.secondUser.id);
        done();
      };

      Promise.resolve(mongoose.model("Image").remove({}))
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => {
          itSelf.secondUser = user;
          fetcher = new NextImage(itSelf.secondUser.id);
        })
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => self._updateImageActiveUser(image, BaseTest.timeBeforeImageLockBegin, itSelf.imageOutOfTimeframeCreatedAt, self.userWithoutTagsDoc.id))
        .then((image) => itSelf.imageOutOfTimeframe = image)
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => itSelf.imageInTimeframe = image)
        .then(() =>  fetcher.fetch())
        .then((image) => itSelf.nextImage = image)
        .then(_onSuccess)
        .catch(done);
    });

    it('should return oldest image if multiple match', (done) => {
      let fetcher: IImageFetcher = new NextImage(self.userWithoutTagsDoc.id, [ModelFactory.imageInProgressA.tags[0], ModelFactory.imageInProgress1.tags[0]]);
      let _onSuccess = image => {
        expect(image).to.be.exist;
        expect(image.cloudinary.publicId).to.equal(ModelFactory.imageInProgress1.cloudinary.publicId);
        done();
      };

      fetcher.fetch()
        .then(_onSuccess)
        .catch(done);
    });

    it('should return image with entityId matching if exist', (done) => {
      let fetcher: IImageFetcher = new NextImage(self.userWithoutTagsDoc.id, [ModelFactory.imageInProgressA.tags[0], ModelFactory.imageInProgress1.tags[0]]);
      let _onSuccess = image => {
        expect(image).to.be.exist;
        expect(image.entityId).to.equal(ModelFactory.imageInProgressA.entityId);
        done();
      };

      fetcher.fetch(ModelFactory.imageInProgressA.entityId.toString())
        .then(_onSuccess)
        .catch(done);
    });

    it('should return null when entityId is not matching any image', (done) => {
      let fetcher: IImageFetcher = new NextImage(self.userWithoutTagsDoc.id, [ModelFactory.imageInProgressA.tags[0], ModelFactory.imageInProgress1.tags[0]]);
      let _onSuccess = image => {
        expect(image).to.not.exist;
        done();
      };

      fetcher.fetch("foo")
        .then(_onSuccess)
        .catch(done);
    });

    it('should return null if no available image found', (done) => {
      let fetcher1: IImageFetcher = new NextImage(self.userWithoutTagsDoc.id, [ModelFactory.imageInProgressA.tags[0], ModelFactory.imageInProgress1.tags[0]]);
      let fetcher2: IImageFetcher = new NextImage(self.userWithoutTagsDoc.id);
      let _onSuccess = image => {
        expect(image).to.be.null;
      };

      Promise.resolve(mongoose.model("Image").remove({}))
        .then(() => fetcher1.fetch())
        .then(_onSuccess)
        .then(() => fetcher2.fetch())
        .then(_onSuccess)
        .then(done)
        .catch(done);
    });

    it('should return image by entity priorities', (done) => {
      let itSelf: any = {};
      let fetcher: NextImage = new NextImage(self.userWithoutTagsDoc.id);
      let loopUntilFindByPrioritySpy = sinon.spy(fetcher, "loopUntilFindByPriority");
      let promiseWhileSpy = sinon.spy(fetcher, "promiseWhile");

      let _onSuccess = (image: ImageModel) => {
        expect(image).to.exist;
        expect(loopUntilFindByPrioritySpy.calledOnce).to.equal(true);
        expect(promiseWhileSpy.calledTwice).to.equal(true); // second call for stopping at the condition
        expect(image.id).to.equal(itSelf.image.id);
        expect(image).to.have.property('updatedAt');
        expect(image).to.have.property('activeUser').and.to.equal(self.userWithoutTagsDoc.id);
        expect(image).to.have.property('status').and.to.equal(eImageStatus.inProgress);

        ConfigModel.getConfig()
          .then((config) =>  config.getEntityPrioritiesSorted())
          .then((sortedEntityIds: string[]) => {
            expect(sortedEntityIds.length).to.equal(2);

            done();
          })
          .catch(done);
      };

      Promise.resolve(mongoose.model("Image").remove({}))
        .then(() => ConfigModel.getConfig())
        .then((config) => {
          return config.addNewEntity(ModelFactory.imageInProgressWithoutTags.entityId.toString())
            .then(() => config.addNewEntity("NoImagesForThisEntity"));
        })
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => itSelf.image = image)
        .then(() => fetcher.fetch())
        .then(_onSuccess)
        .catch(done);
    });

    it('should return image by entity priorities, first priority have no images', (done) => {
      let itSelf: any = {};
      let fetcher: NextImage = new NextImage(self.userWithoutTagsDoc.id);
      let loopUntilFindByPrioritySpy = sinon.spy(fetcher, "loopUntilFindByPriority");
      let promiseWhileSpy = sinon.spy(fetcher, "promiseWhile");

      let _onSuccess = (image: ImageModel) => {
        expect(image).to.exist;
        expect(loopUntilFindByPrioritySpy.calledOnce).to.equal(true);
        expect(promiseWhileSpy.callCount).to.equal(3); // third call for stopping at the condition
        expect(image.id).to.equal(itSelf.image.id);
        expect(image).to.have.property('updatedAt');
        expect(image).to.have.property('activeUser').and.to.equal(self.userWithoutTagsDoc.id);
        expect(image).to.have.property('status').and.to.equal(eImageStatus.inProgress);

        // verify that entityId that had no results will not be considered in later fetch
        ConfigModel.getConfig()
          .then((config) =>  config.getEntityPrioritiesSorted())
          .then((sortedEntityIds: string[]) => {
            //expect(sortedEntityIds.length).to.equal(1);
            // expect(sortedEntityIds[0]).to.equal(ModelFactory.imageInProgressWithoutTags.entityId.toString());

            done();
          })
          .catch(done);
      };

      Promise.resolve(mongoose.model("Image").remove({}))
        .then(() => ConfigModel.getConfig())
        .then((config) => {
          return config.addNewEntity("NoImagesForThisEntity")
            .then(() => config.addNewEntity(ModelFactory.imageInProgressWithoutTags.entityId.toString()));
        })
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => itSelf.image = image)
        .then(() => fetcher.fetch())
        .then(_onSuccess)
        .catch(done);
    });

    it('should return image by specific entity without priorities consideration', (done) => {
      let itSelf: any = {};
      let fetcher: NextImage = new NextImage(self.userWithoutTagsDoc.id);
      let loopUntilFindByPrioritySpy = sinon.spy(fetcher, "loopUntilFindByPriority");
      let promiseWhileSpy = sinon.spy(fetcher, "promiseWhile");

      let _onSuccess = (image: ImageModel) => {
        expect(image).to.exist;
        expect(image.entityId).to.equal(itSelf.image.entityId.toString());

        // image fetched without checking priorities
        expect(loopUntilFindByPrioritySpy.notCalled).to.equal(true);
        expect(promiseWhileSpy.notCalled).to.equal(true);

        done();
      };

      Promise.resolve(mongoose.model("Image").remove({}))
        .then(() => ConfigModel.getConfig())
        .then((config) => {
          return config.addNewEntity("NoImagesForThisEntity")
            .then(() => config.addNewEntity(ModelFactory.imageInProgressWithoutTags.entityId.toString()));
        })
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgressWithoutTags, {entityId: "OtherEntityId"})))
        .then((image) => itSelf.image = image)
        .then(() => fetcher.fetch(itSelf.image.entityId.toString()))
        .then(_onSuccess)
        .catch(done);
    });

    it('should return null if image by specific entityId not exists', (done) => {
      let fetcher: NextImage = new NextImage(self.userWithoutTagsDoc.id);
      let loopUntilFindByPrioritySpy = sinon.spy(fetcher, "loopUntilFindByPriority");
      let promiseWhileSpy = sinon.spy(fetcher, "promiseWhile");

      let _onSuccess = (image: ImageModel) => {
        expect(image).to.not.exist;
        expect(loopUntilFindByPrioritySpy.notCalled).to.equal(true);
        expect(promiseWhileSpy.notCalled).to.equal(true);

        done();
      };

      ConfigModel.getConfig()
        .then((config) => {
          return config.addNewEntity("NoImagesForThisEntity")
            .then(() => config.addNewEntity(ModelFactory.imageInProgressWithoutTags.entityId.toString()));
        })
        .then(() => fetcher.fetch("foo"))
        .then(_onSuccess)
        .catch(done);
    });

    it('should reject if got inner rejection', (done) => {
      let fetcher: NextImage = new NextImage(self.userWithoutTagsDoc.id);
      let loopUntilFindByPriorityStub = sinon.stub(fetcher, "loopUntilFindByPriority").callsFake(() => {
        return Promise.reject("ERROR");
      });
      let promiseWhileSpy = sinon.spy(fetcher, "promiseWhile");

      let _onFail = (err: string) => {
        expect(err).to.exist.and.equal("ERROR");
        expect(loopUntilFindByPriorityStub.calledOnce).to.equal(true);
        expect(promiseWhileSpy.notCalled).to.equal(true);

        done();
      };

     fetcher.fetch()
        .catch(_onFail)
        .catch(done);
    });

  });

});
