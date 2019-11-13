import ImageModel from './image.model';
import {IImageFetcher} from "./image.model";
import UserModel from '../user/user.model';
import * as ModelFactory from '../../helpers/tests/modelFactory'
import {eImageStatus, eImageTask} from "./image.model.interface";
import {eCropAreaStatus} from "./image.model.interface";
import {IImageModel} from "./image.model.interface";
import * as _ from 'lodash';
import * as sinon from 'sinon';
const { expect } = require('chai');
import * as Collections from 'typescript-collections';
import ConfigModel from "../config/config.model";
import {Factory} from "../../helpers/tests/modelFactory";
import { DBService } from '../../services/dbService';

describe('image.model', () => {
  before((done) => {
    DBService.clearDB().then(done);
  });

  describe('.getNext', () => {
    beforeEach((done) => {
      DBService.clearDB().then(done);
    });

    it('should use fetcher "fetch" function with entityId parameter when provided', (done) => {
      let returnImage: ImageModel = new ImageModel({});

      let fetcher:IImageFetcher = {
        fetch: (entityId?:string)=> {
          return Promise.resolve(returnImage);
        }
      };

      let fetchSpy = sinon.spy(fetcher, "fetch");

      ImageModel.getNext(fetcher, "foo")
        .then((image) => {
          expect(image).to.exist.and.equal(returnImage);
          expect(fetchSpy.calledOnce).to.equal(true);
          expect(fetchSpy.getCall(0).args[0]).to.equal("foo");
          done();
        })
        .catch((err) => done(err));
    });

    it('should use fetcher "fetch" function with null parameter as entityId', (done) => {
      let returnImage: ImageModel = new ImageModel({});

      let fetcher:IImageFetcher = {
        fetch: (entityId?:string)=> {
          return Promise.resolve(returnImage);
        }
      };

      let fetchSpy = sinon.spy(fetcher, "fetch");

      ImageModel.getNext(fetcher)
        .then((image) => {
          expect(image).to.exist.and.equal(returnImage);
          expect(fetchSpy.calledOnce).to.equal(true);
          expect(fetchSpy.getCall(0).args[0]).to.equal(null);
          done();
        })
        .catch((err) => done(err));
    });

    it('should reject when fetcher is rejecting', (done) => {
      let fetcher:IImageFetcher = {
        fetch: (entityId?:string)=> {
          return Promise.reject("ERROR!");
        }
      };

      let fetchSpy = sinon.spy(fetcher, "fetch");

      ImageModel.getNext(fetcher, "foo")
        .catch((err) => {
          expect(err).to.exist.and.equal("ERROR!");
          expect(fetchSpy.calledOnce).to.equal(true);
          done();
        })
        .catch((err) => done(err));
    });

  });

  describe('.nextWaitingTask', () => {
    let retryExecution1st = ModelFactory.Factory.subtractMinutesFromNowToDate(15);
    let retryExecution2nd = ModelFactory.Factory.subtractMinutesFromNowToDate(10);
    let retryExecution3rd = ModelFactory.Factory.subtractMinutesFromNowToDate(5);

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageNeedImaginaryConversion, {
          imaginaryId: "img1",
          nextTask: {task: eImageTask.processComplete, lastRetry: retryExecution3rd, retries: 1}
        })))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageNeedImaginaryConversion, {
          imaginaryId: "img2",
          nextTask: {task: eImageTask.processComplete, lastRetry: retryExecution1st, retries: 3}
        })))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageNeedImaginaryConversion, {
          imaginaryId: "img3",
          nextTask: {task: eImageTask.processComplete, lastRetry: retryExecution2nd, retries: 2}
        })))
        .then(() => ImageModel.create(ModelFactory.imageInProgress1))
        .then(() => done())
        .catch(done);
    });

    it("should return an image that have the oldest retry time", (done) => {
      ImageModel.nextWaitingTask(1,4)
        .then((image) => {
          expect(image).to.exist;
          // Following was commented out as this requirement has been removed
          /*expect(image.imaginaryId).to.equal("img2");
          expect(image.nextTask).to.exist.and.have.property("lastRetry").to.not.equal(retryExecution1st);*/
          done();
        })
        .catch(done);
    })

    it("should return image that have the oldest retry time and within the time interval", (done) => {
      ImageModel.nextWaitingTask(9,4)
        .then((image) => {
          expect(image).to.exist;
          expect(image.imaginaryId).to.equal("img2");
          done();
        })
        .catch(done);
    });

    it("should return image that have the oldest retry time, within the time interval and max retries allowed", (done) => {
      ImageModel.nextWaitingTask(9,3)
        .then((image) => {
          expect(image).to.exist;
          expect(image.imaginaryId).to.equal("img2");
          done();
        })
        .catch(done);
    })

    it("should return image that have status 'waitingTask' and 'nextTask.task' value when no 'lastRetry' value is set", (done) => {
      ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {
        status: eImageStatus.waitingTask,
        nextTask: {task: eImageTask.processComplete, retries: 0},
        imaginaryId: "img4"},
        ["cloudinary"]
      ))
        .then (() => {
          ImageModel.nextWaitingTask(11,3)
            .then((image) => {
              expect(image).to.exist;
              // The following line has been commented out because this requirement has been removed
              //expect(image.imaginaryId).to.equal("img4");
              done();
            })
            .catch(done);
        })

    })

    it("should return null when no image is within the time interval", (done) => {
      ImageModel.nextWaitingTask(30,10)
        .then((image) => {
          expect(image).to.equal(null);
          done();
        })
        .catch(done);
    })

  });

  describe('.findById', () => {
    let self  = this;

    beforeEach((done) => {
      DBService.clearDB().then(() => done());
    });

    it('should return image if found', (done) => {
      const _onSuccess = image => {
        expect(image).to.exist;
        expect(image).to.have.property('id')
          .and.to.equal(self.image.id);

        done();
      };

      ImageModel
        .create(ModelFactory.imageInProgress1)
        .then((image) => self.image = image)
        .then(() => ImageModel.findById(self.image.id))
        .then(_onSuccess)
        .catch(done);
    });

    it('should return null if not found', (done) => {
      const _onSuccess = image => {
        expect(image).to.equal(null);
      };

      ImageModel
        .findById("foo")
        .then(_onSuccess)
        .then(() => ImageModel.findById(ModelFactory.objectId1))
        .then(_onSuccess)
        .then(() => done())
        .catch(done);
    })
  });

  describe('.query', function() {

    before((done) => {
      // create 9 times imageInProgress1
      DBService.clearDB()
        .then(() => ImageModel.create(Factory.randomizeTransactionId(ModelFactory.imageInProgress1)))
        .then(() => ImageModel.create(Factory.randomizeTransactionId(ModelFactory.imageInProgress1)))
        .then(() => ImageModel.create(ModelFactory.imageDoneWithoutTags))
        .then(() => ImageModel.create(Factory.randomizeTransactionId(ModelFactory.imageInProgress1)))
        .then(() => ImageModel.create(Factory.randomizeTransactionId(ModelFactory.imageInProgress1)))
        .then(() => ImageModel.create(Factory.randomizeTransactionId(ModelFactory.imageInProgress1)))
        .then(() => ImageModel.create(Factory.randomizeTransactionId(ModelFactory.imageInProgress1)))
        .then(() => ImageModel.create(Factory.randomizeTransactionId(ModelFactory.imageInProgress1)))
        .then(() => ImageModel.create(ModelFactory.imageRejectedWithoutTags))
        .then(() => ImageModel.create(Factory.randomizeTransactionId(ModelFactory.imageInProgress1)))
        .then(() => ImageModel.create(Factory.randomizeTransactionId(ModelFactory.imageInProgress1)))
        .then(() => {

          done()
        })
        .catch(done);
    });

    it('should return all found images using paging', (done) => {
      let foundImagesIds = [];
      let totalImagesReturned = 0;
      let totalImagesValueInReturnObj = 0;
      let limit = 4;
      let offset = 0;

      const nextPage = (): Promise<void> => {
        return new Promise((resolve, reject) => {

          let params = {
            status: eImageStatus.inProgress,
            accountId: ModelFactory.imageInProgress1.entityId
          }

          ImageModel.query(params, limit, offset)
          .then((results) => {
            // merge last pages results with current, keep only unique
            foundImagesIds = _.uniq( [...foundImagesIds, ...results.images.map(image => image.id)]);

            offset = offset + limit;
            totalImagesReturned += results.images.length;
            totalImagesValueInReturnObj = results.total; // should be save value in all calls

            resolve();
          })
        });
      };

      nextPage()
      .then(nextPage)
      .then(nextPage)
      .then(images => {
        expect(foundImagesIds.length).to.equal(9);
        expect(totalImagesReturned).to.equal(9);
        expect(totalImagesValueInReturnObj).to.be.equal(totalImagesReturned);

        done();
      })
      .catch(done);
    });

    it('should return empty array if no results', (done) => {
      ImageModel.query({status: "creatingInvoices"}, 3, 0)
        .then((results) => {
          expect(results.images).to.be.instanceof(Array);
          expect(results.images.length).to.equal(0);
          done();
        })
        .catch(done);
    });

    it('should fail if limit or offset are illegal', (done) => {
      ImageModel.query({status: "creatingInvoices"}, -3, 0)
        .then((results) => {
          expect(true).to.equal(false); // should not reach here
          done();
        })
        .catch((err) => {
          expect(err).to.exist;
          done();
        });
    });

    it('should fail if querying with no params', (done) => {
      ImageModel.query({}, 3, 0)
        .then((results) => {
          expect(true).to.equal(false); // should not reach here
          done();
        })
        .catch((err) => {
          expect(err).to.exist;
          done();
        });
    });

    it('should fail if querying with params as null', (done) => {
      ImageModel.query(null, 3, 0)
        .then((results) => {
          expect(true).to.equal(false); // should not reach here
          done();
        })
        .catch((err) => {
          expect(err).to.exist;
          done();
        });
    });

    it('should fail if querying with one param that is not supported', (done) => {
      ImageModel.query({comment: "bla"}, 3, 0)
        .then((results) => {
          expect(true).to.equal(false); // should not reach here
          done();
        })
        .catch((err) => {
          expect(err).to.exist;
          done();
        });
    });

    it('should success if passing one supported param and one not', (done) => {
      ImageModel.query({comment: "bla", status: eImageStatus.inProgress.toString()}, 3, 0)
        .then((results) => {
          expect(results.images).to.be.instanceof(Array);
          expect(results.images.length).to.be.above(0);
          expect(results.images.length).to.be.equal(3);
          done();
        })
        .catch(done);
    });
  });

  describe('.reportByEntitiesStatuses', () => {
    beforeEach((done) => {
      DBService.clearDB()
        .then(() => done());
    });

    it('should return correct counters fo each entityId', (done) => {
      ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.inProgress}))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.inProgress})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.inProgress})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.rejected})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.done})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.error})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "9876", status: eImageStatus.done})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "9876", status: eImageStatus.done})))
        .then(() => ImageModel.reportByEntitiesStatuses())
        .then((results) => {
          expect(results).to.be.instanceof(Array);
          expect(results.length).to.equal(2);

          expect(results[0].entityId).to.equal("1234");
          expect(results[0].in).to.equal(6);
          expect(results[0].inProgress).to.equal(3);
          expect(results[0].done).to.equal(1);
          expect(results[0].error).to.equal(1);
          expect(results[0].rejected).to.equal(1);

          expect(results[1].entityId).to.equal("9876");
          expect(results[1].in).to.equal(2);
          expect(results[1].inProgress).to.equal(0);
          expect(results[1].done).to.equal(2);
          expect(results[1].error).to.equal(0);
          expect(results[1].rejected).to.equal(0);
          done();
        })
        .catch(done);
    });

    it('should return null if no images found', (done) => {
      ImageModel.reportByEntitiesStatuses()
        .then((results) => {
          expect(results).to.equal(null);
          done();
        })
        .catch(done);
    });

    it('should not return counters for images without entityId', (done) => {
      ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.inProgress}))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.inProgress})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.inProgress})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.rejected})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.done})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgressWithoutEntityId, {status: eImageStatus.error})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "9876", status: eImageStatus.done})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "9876", status: eImageStatus.done})))
        .then(() => ImageModel.reportByEntitiesStatuses())
        .then((results) => {
          expect(results).to.be.instanceof(Array);
          expect(results.length).to.equal(2);
          expect(results[0].entityId).to.equal("1234");
          expect(results[0].in).to.equal(5);
          expect(results[1].entityId).to.equal("9876");
          expect(results[1].in).to.equal(2);
          done();
        })
        .catch(done);
    });

  });

  describe('.reportByEntitiesStatusInProgress', () => {
    beforeEach((done) => {
      DBService.clearDB()
        .then(() => done());
    });

    it('should return all entities exist', (done) => {
      ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.inProgress}))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.inProgress})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.inProgress})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.rejected})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.done})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.error})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "9876", status: eImageStatus.done})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "9876", status: eImageStatus.done})))
        .then(() => ImageModel.reportByEntitiesStatusInProgress())
        .then((results) => {
          expect(results).to.be.instanceof(Array);
          expect(results.length).to.equal(2);

          expect(results[0].entityId).to.equal("1234");
          expect(results[0].inProgress).to.equal(3);

          expect(results[1].entityId).to.equal("9876");
          expect(results[1].inProgress).to.equal(0);
          done();
        })
        .catch(done);
    });

    it('should return null if no images found', (done) => {
      ImageModel.reportByEntitiesStatusInProgress()
        .then((results) => {
          expect(results).to.equal(null);
          done();
        })
        .catch(done);
    });

    it('should not return counters for images without entityId', (done) => {
      ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.inProgress}))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.inProgress})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.inProgress})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.rejected})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "1234", status: eImageStatus.done})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgressWithoutEntityId, {status: eImageStatus.error})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "9876", status: eImageStatus.done})))
        .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgress1, {entityId: "9876", status: eImageStatus.done})))
        .then(() => ImageModel.reportByEntitiesStatusInProgress())
        .then((results) => {
          expect(results).to.be.instanceof(Array);
          expect(results.length).to.equal(2);
          expect(results[0].entityId).to.equal("1234");
          expect(results[0].inProgress).to.equal(3);
          expect(results[1].entityId).to.equal("9876");
          expect(results[1].inProgress).to.equal(0);
          done();
        })
        .catch(done);
    });

  });

  describe('.sortByEntityPriorities', () => {
    interface IEntityId { entityId: string, [others: string]: any; };

    beforeEach((done) => {
      DBService.clearDB()
        .then(done)
        .catch(done);
    });
    after((done) => {
      DBService.clearDB()
        .then(done)
        .catch(done);
    })

    it("should return entities list sorted by priorities", (done) => {
      let me = this;
      let entityIds: IEntityId[] = [{entityId: "entity3"}, {entityId: "entity1"}, {entityId: "entity2"}];
      let configModel: any = {getEntityPrioritiesSorted: () => {} };

      let entityPriorities: string[] = ["entity1", "entity2", "entity3"];
      let entityObjectsDict: Collections.Dictionary<string, IEntityId> = new Collections.Dictionary<string, IEntityId>();

      entityIds.forEach((eo: IEntityId) => entityObjectsDict.setValue(eo.entityId, eo));

      me.configGetConfigStub = sinon.stub(ConfigModel, "getConfig").callsFake(() => Promise.resolve(configModel));
      me.configGetEntityPrioritiesSortedStub = sinon.stub(configModel, "getEntityPrioritiesSorted").callsFake(() => entityPriorities);

      ImageModel.sortByEntityPriorities(entityObjectsDict)
        .then((retValue) => {
          expect(retValue).to.be.instanceOf(Array);
          expect(retValue.length).to.equal(3);
          expect(retValue[0].entityId).to.equal(entityPriorities[0]);
          expect(retValue[1].entityId).to.equal(entityPriorities[1]);
          expect(retValue[2].entityId).to.equal(entityPriorities[2]);

          expect(me.configGetConfigStub.calledOnce).to.equal(true);
          expect(me.configGetEntityPrioritiesSortedStub.calledOnce).to.equal(true);

          me.configGetConfigStub.restore();
          me.configGetEntityPrioritiesSortedStub.restore();

          done();
        })
        .catch(done);
    });

    it("should return entities list sorted by priorities and include entities without priority", (done) => {
      let me = this;
      // the list need an to be sorted
      let entityIds: IEntityId[] = [{entityId: "entity4"}, {entityId: "entity3"}, {entityId: "entity1"}, {entityId: "entity2"}];
      let configModel: any = {getEntityPrioritiesSorted: () => {} };

      let entityPriorities: string[] = ["entity3", "entity2", "entity1"];
      let entityObjectsDict: Collections.Dictionary<string, IEntityId> = new Collections.Dictionary<string, IEntityId>();

      entityIds.forEach((eo: IEntityId) => entityObjectsDict.setValue(eo.entityId, eo));

      me.configGetConfigStub = sinon.stub(ConfigModel, "getConfig").callsFake(() => Promise.resolve(configModel));
      me.configGetEntityPrioritiesSortedStub = sinon.stub(configModel, "getEntityPrioritiesSorted").callsFake(() => entityPriorities);

      ImageModel.sortByEntityPriorities(entityObjectsDict)
        .then((retValue) => {
          expect(retValue).to.be.instanceOf(Array);
          expect(retValue.length).to.equal(4);
          expect(retValue[0].entityId).to.equal(entityPriorities[0]);
          expect(retValue[1].entityId).to.equal(entityPriorities[1]);
          expect(retValue[2].entityId).to.equal(entityPriorities[2]);
          expect(retValue[3].entityId).to.equal("entity4"); // the entity without priority

          expect(me.configGetConfigStub.calledOnce).to.equal(true);
          expect(me.configGetEntityPrioritiesSortedStub.calledOnce).to.equal(true);

          me.configGetConfigStub.restore();
          me.configGetEntityPrioritiesSortedStub.restore();

          done();
        })
        .catch(done);
    });

    it("should return entities list sorted by priorities and ignore entity priority that not exists in parameter list", (done) => {
      let me = this;
      // the list need an to be sorted
      let entityIds: IEntityId[] = [{entityId: "entity3"}, {entityId: "entity1"}];
      let configModel: any = {getEntityPrioritiesSorted: () => {} };

      let entityPriorities: string[] = ["entity2", "entity3", "entity1"];
      let entityObjectsDict: Collections.Dictionary<string, IEntityId> = new Collections.Dictionary<string, IEntityId>();

      entityIds.forEach((eo: IEntityId) => entityObjectsDict.setValue(eo.entityId, eo));

      me.configGetConfigStub = sinon.stub(ConfigModel, "getConfig").callsFake(() => Promise.resolve(configModel));
      me.configGetEntityPrioritiesSortedStub = sinon.stub(configModel, "getEntityPrioritiesSorted").callsFake(() => entityPriorities);

      ImageModel.sortByEntityPriorities(entityObjectsDict)
        .then((retValue) => {
          expect(retValue).to.be.instanceOf(Array);
          expect(retValue.length).to.equal(2);
          expect(retValue[0].entityId).to.equal("entity3");
          expect(retValue[1].entityId).to.equal("entity1");

          expect(me.configGetConfigStub.calledOnce).to.equal(true);
          expect(me.configGetEntityPrioritiesSortedStub.calledOnce).to.equal(true);

          me.configGetConfigStub.restore();
          me.configGetEntityPrioritiesSortedStub.restore();

          done();
        })
        .catch(done);
    });

    it("should reject if ConfigModel is failing", (done) => {
      let me = this;
      // the list need an to be sorted
      let entityIds: IEntityId[] = [{entityId: "entity4"}, {entityId: "entity3"}, {entityId: "entity1"}, {entityId: "entity2"}];
      let configModel: any = {getEntityPrioritiesSorted: () => {} };

      let entityPriorities: string[] = ["entity3", "entity2", "entity1"];
      let entityObjectsDict: Collections.Dictionary<string, IEntityId> = new Collections.Dictionary<string, IEntityId>();

      entityIds.forEach((eo: IEntityId) => entityObjectsDict.setValue(eo.entityId, eo));

      me.configGetConfigStub = sinon.stub(ConfigModel, "getConfig").callsFake(() => Promise.resolve(configModel));
      me.configGetEntityPrioritiesSortedStub = sinon.stub(configModel, "getEntityPrioritiesSorted").callsFake(() => {throw new Error("ERROR!")});

      ImageModel.sortByEntityPriorities(entityObjectsDict)
        .catch((retValue) => {
          expect(retValue).to.exist.and.contain("Failed sort by entity priorities");

          expect(me.configGetConfigStub.calledOnce).to.equal(true);
          expect(me.configGetEntityPrioritiesSortedStub.calledOnce).to.equal(true);

          me.configGetConfigStub.restore();
          me.configGetEntityPrioritiesSortedStub.restore();

          done();
        })
        .catch(done);
    });
  });

  describe('.reportByUsers', () => {
    let self = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => {
          let cropAreasPerDoneImage: number = 3;

          // we create 2 users
          UserModel.createUser(ModelFactory.userWithoutTags)
          .then((user) => self.user1 = user)
          .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
          .then((user) => self.user2 = user)

          // now we create 4 images
          .then(() => ImageModel.create(ModelFactory.Factory.generateImageWithCropAreas(ModelFactory.imageBasicModel1, {
            createdByUserId: self.user1.id,
            createdAt: ModelFactory.Factory.subtractMinutesFromNowToDate(11)
          }, cropAreasPerDoneImage, cropAreasPerDoneImage, {
            status: eImageStatus.done,
            doneByUser: self.user1.id,
            doneAt: ModelFactory.Factory.subtractMinutesFromNowToDate(10)
          })))
          .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageBasicModel1, {
            status: eImageStatus.rejected,
            rejectedByUser: self.user1.id,
            rejectedAt: ModelFactory.Factory.subtractMinutesFromNowToDate(10)
          })))
          .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageBasicModel1, {
            status: eImageStatus.rejected,
            rejectedByUser: self.user1.id,
            rejectedAt: ModelFactory.Factory.subtractMinutesFromNowToDate(10)
          })))
          .then(() => ImageModel.create(ModelFactory.Factory.generateImageWithCropAreas(ModelFactory.imageBasicModel1, {
            createdByUserId: self.user2.id,
            createdAt: ModelFactory.Factory.subtractMinutesFromNowToDate(11)
          }, cropAreasPerDoneImage, cropAreasPerDoneImage, {
            status: eImageStatus.done,
            doneByUser: self.user2.id,
            doneAt: ModelFactory.Factory.subtractMinutesFromNowToDate(10)
          })))
          .then(() => done());
        })
    });

    it('should return correct counters for each user', (done) => {
      ImageModel.reportByUsers(ModelFactory.Factory.subtractMinutesFromNowToDate(20), new Date())
        .then((results) => {
          expect(results).to.be.instanceof(Object);
          expect(Object.keys(results).length).to.equal(2);

          expect(results[self.user1.id]).to.exist;
          expect(results[self.user1.id].cropAreas).to.equal(3);
          expect(results[self.user1.id].done).to.equal(1);
          expect(results[self.user1.id].rejected).to.equal(2);

          expect(results[self.user2.id]).to.exist;
          expect(results[self.user2.id].cropAreas).to.equal(3);
          expect(results[self.user2.id].done).to.equal(1);
          expect(results[self.user2.id].rejected).to.not.exist;
          done();
        })
        .catch(done);
    });

    it('should return empty object if had no results', (done) => {
      ImageModel.reportByUsers(ModelFactory.Factory.subtractMinutesFromNowToDate(1), new Date())
        .then((results) => {
          expect(results).to.equal(null);
          done();
        })
        .catch(done);
    });

  });

  describe('.reportByEntities', () => {
    let self = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => {
          let cropAreasPerDoneImage: number = 3;

          UserModel.createUser(ModelFactory.userWithoutTags)
          .then((user) => self.user1 = user)
          .then(() => ImageModel.create(ModelFactory.Factory.generateImageWithCropAreas(ModelFactory.imageBasicModel1, {
            createdByUserId: self.user1.id,
            createdAt: ModelFactory.Factory.subtractMinutesFromNowToDate(11)
          }, cropAreasPerDoneImage, cropAreasPerDoneImage, {
            createdAt: ModelFactory.Factory.subtractMinutesFromNowToDate(30),
            status: eImageStatus.done,
            entityId: "entity1",
            doneByUser: self.user1.id,
            doneAt: ModelFactory.Factory.subtractMinutesFromNowToDate(10)
          })))
          .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageBasicModel1, {
            createdAt: ModelFactory.Factory.subtractMinutesFromNowToDate(13),
            status: eImageStatus.rejected,
            entityId: "entity1",
            rejectedByUser: self.user1.id,
            rejectedAt: ModelFactory.Factory.subtractMinutesFromNowToDate(10)
          })))
          .then(() => ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageBasicModel1, {
            createdAt: ModelFactory.Factory.subtractMinutesFromNowToDate(12),
            status: eImageStatus.rejected,
            entityId: "entity2",
            rejectedByUser: self.user1.id,
            rejectedAt: ModelFactory.Factory.subtractMinutesFromNowToDate(10)
          })))
          .then(() => ImageModel.create(ModelFactory.Factory.generateImageWithCropAreas(ModelFactory.imageBasicModel1, {
            createdByUserId: self.user1.id,
            createdAt: ModelFactory.Factory.subtractMinutesFromNowToDate(11)
          }, cropAreasPerDoneImage, cropAreasPerDoneImage, {
            createdAt: ModelFactory.Factory.subtractMinutesFromNowToDate(13),
            status: eImageStatus.done,
            entityId: "entity1",
            doneByUser: self.user1.id,
            doneAt: ModelFactory.Factory.subtractMinutesFromNowToDate(10)
          })))
          .then(() => done());
        })
    });

    it('should return correct counters for each entity', (done) => {
      ImageModel.reportByEntities(ModelFactory.Factory.subtractMinutesFromNowToDate(20), new Date())
        .then((results) => {
          expect(results).to.be.instanceof(Object);
          expect(Object.keys(results).length).to.equal(2);

          expect(results["entity1"]).to.exist;
          expect(results["entity1"].cropAreas).to.equal(6);
          expect(results["entity1"].done).to.equal(2);
          expect(results["entity1"].rejected).to.equal(1);
          expect(results["entity1"].created).to.equal(2);

          expect(results["entity2"]).to.exist;
          expect(results["entity2"].cropAreas).to.not.exist;
          expect(results["entity2"].done).to.not.exist;
          expect(results["entity2"].rejected).to.equal(1);
          expect(results["entity2"].created).to.equal(1);
          done();
        })
        .catch(done);
    });

    it('should return empty object if had no results', (done) => {
      ImageModel.reportByEntities(ModelFactory.Factory.subtractMinutesFromNowToDate(1), new Date())
        .then((results) => {
          expect(results).to.equal(null);
          done();
        })
        .catch(done);
    });

  });

  describe('.create', () => {
    before((done) => {
      DBService.clearDB()
        .then(() => done());
    });

    it('should return ImageModel if created successfully', (done) => {
      let imageObj: IImageModel = _.cloneDeep(ModelFactory.imageInProgress1);

      ImageModel.create(imageObj)
        .then((image) => {
          expect(image).to.exist;
          expect(image.id).to.exist;
          expect(image.createdAt).to.exist;
          expect(image.updatedAt).to.not.exist;
          expect(image.reportId).to.exist.and.equal(imageObj.reportId);
          done();
        })
        .catch(done);
    });

    it('should return null if not created', (done) => {
      ImageModel.create(null)
        .catch((err) => {
          expect(err).to.exist;
        })
        .then(() => ImageModel.create(<IImageModel>{}))
        .catch((err) => {
          expect(err).to.exist;
          done();
        })
        .catch(done);
    });

    it('should enforce unique index "requestMetadata.transactionId"', (done) => {
      let imageObj: IImageModel = _.cloneDeep(ModelFactory.imageInProgress1);

      ImageModel.create(imageObj)
        .then((image) => expect(image).to.exist)
        .then(() => ImageModel.create(imageObj))
        .catch((err) => {
          expect(err).to.exist;
          expect(err.message).to.contain("E11000");

          done();
        })
        .catch(done);
    });
  });


  describe('#logTaskFailure', () => {
    let self = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => done())
        .catch(done);
    });

    it("should return updated image when saved successfully", (done) => {
      ImageModel.create(ModelFactory.imageNeedImaginaryConversion)
        .then((image) => image.logTaskFailure(["error message"], eImageTask.processComplete))
        .then((image) => {
          expect(image).to.exist;
          expect(image).to.be.instanceof(ImageModel)
          expect(image.nextTask.errorLog).to.exist;
          expect(image.nextTask.errorLog[0]).to.exist.and.have.property("message").equal("error message");
          expect(image.nextTask.errorLog[0].occurredAt).to.exist;
          expect(image.nextTask.errorLog[0].task).to.exist.and.equal(eImageTask.processComplete);
          expect(image.nextTask.retries).to.exist.and.equal(1);
          expect(image.nextTask.task).to.exist.and.equal(eImageTask.processComplete);
          done();
        })
        .catch(done);
    });

    it("should return updated image when saved successfully two errors", (done) => {
      ImageModel.create(ModelFactory.imageNeedImaginaryConversion)
        .then((image) => {
          self.image = image
          return image.logTaskFailure(["error1"], eImageTask.processComplete)
        })
        .then(() => self.image.logTaskFailure(["error2"], eImageTask.processComplete))
        .then((image) => {
          expect(image).to.exist;
          expect(image).to.be.instanceof(ImageModel)
          expect(image.nextTask.errorLog).to.exist;
          expect(image.nextTask.errorLog.length).to.equal(2);
          expect(image.nextTask.errorLog[1].message).to.equal("error2");
          expect(image.nextTask.errorLog[1].task).to.equal(eImageTask.processComplete);
          expect(image.nextTask.retries).to.exist.and.equal(2);
          done();
        })
        .catch(done);
    });

    it("should return updated image when saved successfully for first time", (done) => {
      let imgClone = _.cloneDeep(ModelFactory.imageNeedImaginaryConversion);

      delete imgClone["imaginaryConversionState"];

      ImageModel.create(imgClone)
        .then((image) => image.logTaskFailure(["first error"], eImageTask.processComplete))
        .then((image) => {
          expect(image).to.exist;
          expect(image).to.be.instanceof(ImageModel)
          expect(image.nextTask.errorLog).to.exist;
          expect(image.nextTask.errorLog.length).to.equal(1);
          expect(image.nextTask.errorLog[0].message).to.equal("first error");
          expect(image.nextTask.retries).to.exist.and.equal(1);
          expect(image.nextTask.task).to.exist.and.equal(eImageTask.processComplete);
          done();
        })
        .catch(done);
    })
  });


  describe('#createCropArea', () => {
    let userWithoutTagsDoc;
    let self  = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.userWithoutTagsDoc = user)
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => self.image = image)
        .then(() => done())
        .catch(done);
    });

    it('should add cropArea value to existing image', (done) => {
      let testStartedAtTime = new Date().getTime();
      const _onSuccess = cropArea => {
        expect(cropArea.id).to.exist;
        expect(self.image.cropAreas.length).to.equal(1);
        expect(cropArea.id).to.equal(self.image.cropAreas[0].id);
        expect(self.image.cropAreas[0].createdByUserId).to.equal(self.userWithoutTagsDoc.id);
        expect(self.image.cropAreas[0].status).to.equal(eCropAreaStatus.fresh);
        expect(self.image.updatedAt.getTime() - testStartedAtTime >= 0).to.equal(true);
        done();
      };

      self.image.createCropArea(self.userWithoutTagsDoc.id, ModelFactory.cropAreaRequestBody1)
        .then(_onSuccess)
        .catch(done);
    });

    it('should add more than one cropArea to existing image', (done) => {
      let testStartedAtTime = new Date().getTime();
      const _onSuccess = cropArea => {
        expect(cropArea.id).to.exist;
        expect(self.image.cropAreas.length).to.equal(2);
        expect(cropArea.id).to.equal(self.image.cropAreas[1].id);
        expect(cropArea.id).to.not.equal(self.image.cropAreas[0].id);
        expect(self.image.cropAreas[1].createdByUserId).to.equal(self.userWithoutTagsDoc.id);
        expect(self.image.updatedAt.getTime() - testStartedAtTime >= 0).to.equal(true);
        done();
      };

      self.image.createCropArea(self.userWithoutTagsDoc.id, ModelFactory.cropAreaRequestBody1)
        .then(() => self.image.createCropArea(self.userWithoutTagsDoc.id, ModelFactory.cropAreaRequestBody1))
        .then(_onSuccess)
        .catch(done);
    });

    it('should reject creating cropArea with missing body required params', (done) => {
      const _onReject = rejectMessage => {
        expect(rejectMessage).to.exist;

        ImageModel.findById(self.image.id)
          .then((image) => {
            expect(image.cropAreas.length).to.equal(0);
            expect(image.updatedAt).to.be.undefined;
            done();
          })
          .catch(done)
      };

      self.image.createCropArea(self.userWithoutTagsDoc.id, {})
        .catch(_onReject)
        .catch(done);
    });
  });

  describe('#deleteCropArea', () => {
    let userWithoutTagsDoc;
    let self  = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.userWithoutTagsDoc = user)
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => {
          self.image = image;
          self.cropArea = null;
        })
        .then(() => done())
        .catch(done);
    });

    it('should delete an existing cropArea of image', (done) => {
      let testStartedAtTime;

      const _onSuccess = wasDeleted => {
        expect(wasDeleted).to.equal(true);
        expect(self.image.cropAreas.length).to.equal(0);
        expect(self.image.updatedAt.getTime() - testStartedAtTime >= 0).to.equal(true);

        done();
      };

      self.image.createCropArea(self.userWithoutTagsDoc.id, ModelFactory.cropAreaRequestBody1)
        .then((cropArea) => {
          testStartedAtTime = new Date().getTime();
          self.cropArea = cropArea;
          return self.image.deleteCropArea(cropArea.id);
        })
        .then(_onSuccess)
        .catch(done);
    });

    it('should delete only cropArea with mentioned id, when multiple are existing', (done) => {
      let testStartedAtTime;

      const _onSuccess = wasDeleted => {
        expect(wasDeleted).to.equal(true);
        expect(self.image.cropAreas.length).to.equal(1);
        expect(self.image.cropAreas[0]).to.not.equal(self.cropArea.id);
        expect(self.image.updatedAt.getTime() - testStartedAtTime >= 0).to.equal(true);

        done();
      };

      self.image.createCropArea(self.userWithoutTagsDoc.id, ModelFactory.cropAreaRequestBody1)
        .then(() => self.image.createCropArea(self.userWithoutTagsDoc.id, ModelFactory.cropAreaRequestBody1))
        .then((cropArea) => {
          testStartedAtTime = new Date().getTime();
          self.cropArea = cropArea;
          return self.image.deleteCropArea(cropArea.id); // deleting the second cropArea
        })
        .then(_onSuccess)
        .catch(done);
    });

    it('should return false if cropArea was not found', (done) => {
      let testStartedAtTime;

      let _onSuccess = (wasDeleted: boolean) => {
        expect(wasDeleted).to.equal(false);
        expect(self.image.cropAreas.length).to.equal(1);
        expect(self.image.updatedAt.getTime() - testStartedAtTime < 0).to.equal(true);
      };

      self.image.createCropArea(self.userWithoutTagsDoc.id, ModelFactory.cropAreaRequestBody1)
        .then((cropArea) => {
          testStartedAtTime = new Date().getTime();
          return self.image.deleteCropArea("foo");
        })
        .then(_onSuccess)
        .then((cropArea) => {
          testStartedAtTime = new Date().getTime();
          return self.image.deleteCropArea(ModelFactory.objectId1);
        })
        .then(_onSuccess)
        .then(() => done())
        .catch(done);
    });
  });

  describe('#queueComplete', () => {
    let userWithoutTagsDoc;
    let self  = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.userWithoutTagsDoc = user)
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTagsWithCropAreas))
        .then((image) => {
          self.image = image;
          self.updateStatusStub = sinon.stub(ImageModel, "updateStatus").callsFake(() => {
            return Promise.resolve(self.returnValue)
          })
        })
        .then(() => done())
        .catch(done);
    });

    afterEach(() => {
      self.updateStatusStub.restore();
    });

    it('should return true if image status is one of {inProgress/done/rejected}', (done) => {
      self.returnValue = true;

      const _onSuccess = wasUpdated => {
        expect(wasUpdated).to.equal(true);
        expect(self.updateStatusStub.calledOnce).to.equal(true);

        done();
      };

      self.image.queueComplete(self.userWithoutTagsDoc.id, null, null)
        .then(_onSuccess)
        .catch(done);
    });

    it('should return false if image status is not one of {inProgress/done/rejected}', (done) => {
      self.image = null;
      self.returnValue = null;

      const _onSuccess = wasUpdated => {
        expect(wasUpdated).to.equal(false);
        expect(self.image.status).to.equal(eImageStatus.failedCreatingAllInvoices);
        expect(self.updateStatusStub.notCalled).to.equal(true);

        done();
      };

      ImageModel.create(ModelFactory.imageFailedCreatingAllInvoicesWithoutTags)
        .then((image) => self.image = image)
        .then(() => self.image.queueComplete(self.userWithoutTagsDoc.id, null, null))
        .then(_onSuccess)
        .catch(done);
    });

    it('should reject from complete if image have no cropAreas', (done) => {

      self.image = null;
      self.returnValue = null;

      const _onRejected = error => {
        expect(self.image.status).to.equal(eImageStatus.done);
        expect(self.updateStatusStub.notCalled).to.equal(true);

        done();
      };

      ImageModel.create(ModelFactory.imageDoneWithoutTags)
        .then((image) => self.image = image)
        .then(() => self.image.queueComplete(self.userWithoutTagsDoc.id, null, null))
        .then(_onRejected)
        .catch(_onRejected);
    });
  });

  describe('#reject', () => {
    let userWithoutTagsDoc;
    let self  = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.userWithoutTagsDoc = user)
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => {
          self.image = image;
          self.updateStatusStub = sinon.stub(ImageModel, "updateStatus").callsFake(() => {
            return Promise.resolve(self.returnValue)
          })
        })
        .then(() => done())
        .catch(done);
    });

    afterEach(() => {
      self.updateStatusStub.restore();
    });

    it('should return true if image status is one of {inProgress/rejected}', (done) => {
      self.returnValue = true;

      const _onSuccess = wasUpdated => {
        expect(wasUpdated).to.equal(true);
        expect(self.updateStatusStub.calledOnce).to.equal(true);

        done();
      };

      self.image.reject(self.userWithoutTagsDoc.id, null, null)
        .then(_onSuccess)
        .catch(done);
    });

    it('should return false if image status is in done status', (done) => {
      self.image = null;
      self.returnValue = false;

      const _onSuccess = wasUpdated => {
        expect(wasUpdated).to.equal(false);
        expect(self.updateStatusStub.notCalled).to.equal(true);

        done();
      };

      ImageModel.create(ModelFactory.imageDoneWithoutTags)
        .then((image) => self.image = image)
        .then(() => self.image.reject(self.userWithoutTagsDoc.id, null, null))
        .then(_onSuccess)
        .catch(done);
    });
  });

  describe('#setImaginaryData', () => {
    let self = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(done);
    });

    it('should return true if saved successfully', (done) => {
      let valuesToSet = {imaginaryId: "test123", cloudinaryId: "test456", type: "test789"};

      const _onSuccess = isModified => {
        expect(isModified).to.equal(true);
        expect(self.image.updatedAt).to.exist;
        expect(self.image.imaginaryId).to.equal(valuesToSet.imaginaryId);
        expect(self.image.cloudinary.publicId).to.equal(valuesToSet.cloudinaryId);
        expect(self.image.cloudinary.format).to.equal(valuesToSet.type);

        done();
      };

      ImageModel.create(ModelFactory.imageInProgressWithoutTags)
        .then((image) => {
          self.image = image;
          return image.setImaginaryData(valuesToSet.imaginaryId, {publicId: valuesToSet.cloudinaryId, format: valuesToSet.type});
        })
        .then(_onSuccess)
        .catch(done);
    });

    it('should return true if saved successfully whith no cloudinary data', (done) => {
      let valuesToSet = {imaginaryId: "test123"};

      const _onSuccess = isModified => {
        expect(isModified).to.equal(true);
        expect(self.image.updatedAt).to.exist;
        expect(self.image.imaginaryId).to.equal(valuesToSet.imaginaryId);
        expect(self.image.cloudinary.publicId).to.not.exist;
        expect(self.image.cloudinary.format).to.not.exist;

        done();
      };

      ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageInProgressWithoutTags, null, ["cloudinary"]))
        .then((image) => {
          self.image = image;
          return image.setImaginaryData(valuesToSet.imaginaryId);
        })
        .then(_onSuccess)
        .catch(done);
    });

    it('should reject if mongo return error', (done) => {
      let valuesToSet = {imaginaryId: "test123", cloudinaryId: "test456", type: "test789"};

      const _onFail = error => {
        expect(error).to.exist;
        expect(error.toString()).to.contain("ERROR MESSAGE");

        self.mongooseSaveStub.restore();
        done();
      };

      ImageModel.create(ModelFactory.imageInProgressWithoutTags)
        .then((image) => {
          self.image = image;
          return image.mongooseDocument;
        })
        .then((document) => {
          self.mongooseSaveStub = sinon.stub(document, "save").callsFake((cb) => {
            cb({message: "ERROR MESSAGE"}, null);
          });

          return self.image.setImaginaryData(valuesToSet.imaginaryId, {publicId: valuesToSet.cloudinaryId, format: valuesToSet.type});
        })
        .catch(_onFail)
        .catch(done);
    });
  });

  describe('#setCropAreaImage', () => {
    let userWithoutTagsDoc;
    let self  = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.userWithoutTagsDoc = user)
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => {
          self.image = image;
          return self.image.createCropArea(self.userWithoutTagsDoc.id, ModelFactory.cropAreaRequestBody1);
        })
        .then((cropArea) => {
          self.cropArea = cropArea;
          return self.image.createCropArea(self.userWithoutTagsDoc.id, ModelFactory.cropAreaRequestBody1)})
        .then(() => done())
        .catch(done);
    });

    afterEach(() => {
    });

    it('should return modified cropArea if saved successfully', (done) => {
      const valuesToSet = {imaginaryId: "test123", cloudinaryId: "test456", type: "test789"};

      const _onSuccess = modifiedCropArea => {
        expect(modifiedCropArea.updatedAt).to.exist;
        expect(modifiedCropArea.status).to.equal(self.cropArea.status);
        expect(modifiedCropArea.imaginaryId).to.equal(valuesToSet.imaginaryId);
        expect(modifiedCropArea.cloudinary.publicId).to.equal(valuesToSet.cloudinaryId);
        expect(modifiedCropArea.cloudinary.format).to.equal(valuesToSet.type);

        done();
      };

      self.image.setCropAreaImage(self.cropArea.id, valuesToSet.imaginaryId, valuesToSet.cloudinaryId, valuesToSet.type)
        .then(_onSuccess)
        .catch(done);
    });

    it('should return null if cropArea not exist', (done) => {
      let valuesToSet = {imaginaryId: "test123", cloudinaryId: "test456", type: "test789"};

      const _onSuccess = modifiedCropArea => {
        expect(modifiedCropArea).to.not.exist;

        done();
      };

      self.image.setCropAreaImage("notExistCropArea", valuesToSet.imaginaryId, valuesToSet.cloudinaryId, valuesToSet.type)
        .then(_onSuccess)
        .catch(done);
    });
  });

  describe('#setCropAreaInvoice', () => {
    let userWithoutTagsDoc;
    let self  = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.userWithoutTagsDoc = user)
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => {
          self.image = image;
          return self.image.createCropArea(self.userWithoutTagsDoc.id, ModelFactory.cropAreaRequestBody1);
        })
        .then((cropArea) => {
          self.cropArea = cropArea;
          return self.image.createCropArea(self.userWithoutTagsDoc.id, ModelFactory.cropAreaRequestBody1)})
        .then(() => done())
        .catch(done);
    });

    afterEach(() => {
    });

    it('should return modified cropArea if saved successfully', (done) => {
      let invoiceId = "test123";

      const _onSuccess = modifiedCropArea => {
        expect(modifiedCropArea.updatedAt).to.exist;
        expect(modifiedCropArea.invoiceCreatedAt).to.exist;
        expect(modifiedCropArea.status).to.equal(eCropAreaStatus.invoiceCreated);
        expect(modifiedCropArea.invoiceId).to.equal(invoiceId);

        done();
      };

      self.image.setCropAreaInvoice(self.cropArea.id, invoiceId)
        .then(_onSuccess)
        .catch(done);
    });

    it('should return null if cropArea not exist', (done) => {
      let invoiceId = "test123";

      const _onSuccess = modifiedCropArea => {
        expect(modifiedCropArea).to.not.exist;

        done();
      };

      self.image.setCropAreaInvoice("foo", invoiceId)
        .then(_onSuccess)
        .catch(done);
    });

    it('should return null if cropAreaId is empty', (done) => {
      let invoiceId = "test123";

      const _onSuccess = modifiedCropArea => {
        expect(modifiedCropArea).to.not.exist;

        done();
      };

      self.image.setCropAreaInvoice("", invoiceId)
        .then(_onSuccess)
        .catch(done);
    });

    it('should return null if invoiceId is empty', (done) => {
      const _onSuccess = modifiedCropArea => {
        expect(modifiedCropArea).to.not.exist;

        done();
      };

      self.image.setCropAreaInvoice("foo", "")
        .then(_onSuccess)
        .catch(done);
    });
  });

  describe('#setCropAreaEnqueued', () => {
    let self  = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.userWithoutTagsDoc = user)
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => {
          self.image = image;
          return self.image.createCropArea(self.userWithoutTagsDoc.id, ModelFactory.cropAreaRequestBody1);
        })
        .then((cropArea) => {
          self.cropArea = cropArea;
          return self.image.createCropArea(self.userWithoutTagsDoc.id, ModelFactory.cropAreaRequestBody1)})
        .then(() => done())
        .catch(done);
    });

    it('should return updated image if saved successfully', (done) => {
      const _onSuccess = image => {
        expect(image).to.exist;
        expect(image.cropAreas[0].queue).to.exist;
        expect(image.cropAreas[0].queue.messageId).to.equal("fakeMessageId");
        expect(image.cropAreas[0].queue.enqueuedAt).to.exist;

        done();
      };

      ImageModel.setCropAreaEnqueued(self.image.id, self.image.cropAreas[0].id, "fakeMessageId")
        .then(_onSuccess)
        .catch(done);
    });

    it('should reject with error message if image or cropArea not found', (done) => {
      const _onFailure = msg => {
        expect(msg).to.exist;
      };

      ImageModel.setCropAreaEnqueued(self.image.id, ModelFactory.objectId1, "fakeMessageId")
        .catch((e) => {
          _onFailure(e);
          return ImageModel.setCropAreaEnqueued(ModelFactory.objectId1, self.image.cropAreas[0].id, "fakeMessageId")
        })
        .catch((e) => {
          _onFailure(e);
          done();
        })
        .catch(done);
    });
  });

  describe('#setCropAreaTransactionId', () => {
    let self  = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.userWithoutTagsDoc = user)
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => {
          self.image = image;
          return self.image.createCropArea(self.userWithoutTagsDoc.id, ModelFactory.cropAreaRequestBody1);
        })
        .then((cropArea) => {
          self.cropArea = cropArea;
          return self.image.createCropArea(self.userWithoutTagsDoc.id, ModelFactory.cropAreaRequestBody1)})
        .then(() => done())
        .catch(done);
    });

    it('should return updated image if saved successfully', (done) => {
      const _onSuccess = image => {
        expect(image).to.exist;
        expect(image.cropAreas[0].queue).to.exist;
        expect(image.cropAreas[0].queue.transactionId).to.exist;
        expect(image.cropAreas[0].queue.messageId).to.not.exist;
        expect(image.cropAreas[0].queue.enqueuedAt).to.not.exist;

        done();
      };

      ImageModel.setCropAreaTransactionId(self.image.id, self.image.cropAreas[0].id)
        .then(_onSuccess)
        .catch(done);
    });

    it('should reject with error message if image or cropArea not found', (done) => {
      const _onFailure = msg => {
        expect(msg).to.exist;
      };

      ImageModel.setCropAreaTransactionId(self.image.id, ModelFactory.objectId1)
        .catch((e) => {
          _onFailure(e);
          done();
        })
        .catch(done);
    });

    it('should reject with error message if messageId exists and override=false', (done) => {
      const _onFailure = msg => {
        expect(msg).to.exist;
      };

      ImageModel.setCropAreaEnqueued(self.image.id, self.image.cropAreas[0].id, "messageId")
        .then(() => {
          ImageModel.setCropAreaTransactionId(self.image.id, self.image.cropAreas[0].id)
            .catch((e) => {
              _onFailure(e);
              done();
            })
        })
        .catch(done);
    });

    it('should reject when transactionId already exists but messageId not exists', (done) => {
      const _onFailure = err => {
        expect(err).to.exist;

        done();
      };

      ImageModel.setCropAreaTransactionId(self.image.id, self.image.cropAreas[0].id)
        .then(() => ImageModel.setCropAreaTransactionId(self.image.id, self.image.cropAreas[0].id))
        .catch((e) => _onFailure(e))
        .catch(done);
    });

    it('should reject with error message if messageId already exists', (done) => {
      const _onFailure = msg => {
        expect(msg).to.exist;
      };

      ImageModel.setCropAreaEnqueued(self.image.id, self.image.cropAreas[0].id, "messageId")
        .then(() => {
          ImageModel.setCropAreaTransactionId(self.image.id, self.image.cropAreas[0].id)
            .catch((e) => {
              _onFailure(e);
              done();
            })
        })
        .catch(done);
    });

    it('should resolve when transactionId already exists and override=true', (done) => {
      const _onSuccess = image => {
        expect(image).to.exist;
        expect(image.cropAreas[0].queue).to.exist;
        expect(image.cropAreas[0].queue.transactionId).to.exist;
        expect(image.cropAreas[0].queue.messageId).to.not.exist;
        expect(image.cropAreas[0].queue.enqueuedAt).to.not.exist;

        done();
      };

      ImageModel.setCropAreaTransactionId(self.image.id, self.image.cropAreas[0].id)
        .then(() => ImageModel.setCropAreaTransactionId(self.image.id, self.image.cropAreas[0].id, true)
        .then((image) => _onSuccess(image)))
        .catch(done);
    });

    it('should resolve when override=true and messageId already exists (and also override messageId)', (done) => {
      const _onSuccess = image => {
        expect(image).to.exist;
        expect(image.cropAreas[0].queue).to.exist;
        expect(image.cropAreas[0].queue.transactionId).to.exist;
        expect(image.cropAreas[0].queue.messageId).to.not.exist;
        expect(image.cropAreas[0].queue.enqueuedAt).to.not.exist;

        done();
      };

      ImageModel.setCropAreaEnqueued(self.image.id, self.image.cropAreas[0].id, "messageId")
        .then(() => ImageModel.setCropAreaTransactionId(self.image.id, self.image.cropAreas[0].id, true)
                      .then((image) => _onSuccess(image)))
        .catch(done);
    });
  });

  describe('#setImageTransactionId', () => {
    let self  = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.userWithoutTagsDoc = user)
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => self.image = image )
        .then(() => done())
        .catch(done);
    });

    it('should return updated image if saved successfully', (done) => {
      const _onSuccess = image => {
        expect(image).to.exist;
        expect(image.transactionId).to.exist;

        done();
      };

      ImageModel.setImageTransactionId(self.image.id)
        .then(_onSuccess)
        .catch(done);
    });

    it('should reject with error when transactionId already exists', (done) => {
      const _onFailure = msg => {
        expect(msg).to.exist;
      };

      ImageModel.setImageTransactionId(self.image.id)
        .then(() => {
          ImageModel.setImageTransactionId(self.image.id)
            .catch((e) => {
              _onFailure(e);
              done();
            })
        })
        .catch(done);
    });

    it('should resolve when transactionId already exists and override=true', (done) => {
      const _onSuccess = image => {
        expect(image).to.exist;
        expect(image.transactionId).to.exist;
        expect(image.transactionId).to.not.equal(self.oldTransactionId);

        done();
      };

      ImageModel.setImageTransactionId(self.image.id)
        .then((image => {
          self.oldTransactionId = image.transactionId;
        }))
        .then(() => ImageModel.setImageTransactionId(self.image.id, true))
        .then((image) => _onSuccess(image))
        .catch(done);
    });
  });

  describe('.updateStatus', () => {
    let userWithoutTagsDoc;
    let self  = this;

    beforeEach((done) => {
      DBService.clearDB()
        .then(() => UserModel.createUser(ModelFactory.userWithoutTags))
        .then((user) => self.userWithoutTagsDoc = user)
        .then(() => ImageModel.create(ModelFactory.imageInProgressWithoutTags))
        .then((image) => {
          self.image = image;
        })
        .then(() => done())
        .catch(done);
    });

    it('should return true if image status was saved as waitingTask', (done) => {
      const _onSuccess = wasUpdated => {
        expect(wasUpdated).to.equal(true);
        expect(self.image.status).to.equal(eImageStatus.waitingTask);
        expect(self.image.nextTask).to.exist.and.to.have.property("task").equal(eImageTask.processComplete);
        expect(self.image.comment).to.equal("comment");
        expect(self.image.clientUrl).to.equal("clientUrl");
        expect(self.image.doneByUser).to.equal(self.userWithoutTagsDoc.id);
        expect(self.image.doneAt).to.not.equal(null);
        expect(self.image.rejectedByUser).to.not.exist;
        expect(self.image.rejectedAt).to.not.exist;
        expect(self.image.updatedAt).to.not.equal(null);

        done();
      };

      ImageModel.updateStatus(self.image, self.userWithoutTagsDoc.id, eImageStatus.waitingTask, "comment", "clientUrl")
        .then(_onSuccess)
        .catch(done);
    });

    it('should return true if image status saved as rejected', (done) => {
      const _onSuccess = wasUpdated => {
        expect(wasUpdated).to.equal(true);
        expect(self.image.status).to.equal(eImageStatus.rejected);
        expect(self.image.nextTask.task).to.not.exist;
        expect(self.image.comment).to.equal("comment");
        expect(self.image.clientUrl).to.equal("clientUrl");
        expect(self.image.rejectedByUser).to.equal(self.userWithoutTagsDoc.id);
        expect(self.image.rejectedAt).to.exist;
        expect(self.image.doneByUser).to.not.exist;
        expect(self.image.doneAt).to.not.exist;
        expect(self.image.updatedAt).to.not.equal(null);

        done();
      };

      self.image.reject(self.userWithoutTagsDoc.id, "comment", "clientUrl")
        .then(_onSuccess)
        .catch(done);
    });

    it('should return true if image status already was done and queued for completing again', (done) => {
      self.image = null;

      const _onSuccess = wasUpdated => {
        expect(wasUpdated).to.equal(true);
        expect(self.image.status).to.equal(eImageStatus.waitingTask);
        expect(self.image.nextTask).to.exist.and.to.have.property("task").equal(eImageTask.processComplete);
        expect(self.image.comment).to.equal(ModelFactory.imageDoneWithoutTags.comment);
        expect(self.image.clientUrl).to.equal(ModelFactory.imageDoneWithoutTags.clientUrl);
        expect(self.image.doneByUser).to.equal(self.userWithoutTagsDoc.id);
        expect(self.image.doneAt).to.not.equal(null);
        expect(self.image.rejectedByUser).to.not.exist;
        expect(self.image.rejectedAt).to.not.exist;
        expect(self.image.updatedAt).to.not.equal(null);

        done();
      };

      ImageModel.create(ModelFactory.imageDoneWithoutTags)
        .then((image) => self.image = image)
        .then(() => ImageModel.updateStatus(self.image, self.userWithoutTagsDoc.id, eImageStatus.waitingTask, null, null))
        .then(_onSuccess)
        .catch(done);
    });

    it('should return true if image status was rejected and saved as waitingTask', (done) => {
      self.image = null;

      const _onSuccess = wasUpdated => {
        expect(wasUpdated).to.equal(true);
        expect(self.image.status).to.equal(eImageStatus.waitingTask);
        expect(self.image.nextTask).to.exist.and.to.have.property("task").equal(eImageTask.processComplete);
        expect(self.image.comment).to.equal(ModelFactory.imageRejectedWithoutTags.comment);
        expect(self.image.clientUrl).to.equal(ModelFactory.imageRejectedWithoutTags.clientUrl);
        expect(self.image.doneByUser).to.equal(self.userWithoutTagsDoc.id);
        expect(self.image.doneAt).to.not.equal(null);
        expect(self.image.updatedAt).to.not.equal(null);

        done();
      };

      ImageModel.create(ModelFactory.imageRejectedWithoutTags)
        .then((image) => self.image = image)
        .then(() => ImageModel.updateStatus(self.image, self.userWithoutTagsDoc.id, eImageStatus.waitingTask, null, null))
        .then(_onSuccess)
        .catch(done);
    });

    it('should return true if image status was done and saved as creatingInvoices', (done) => {
      self.image = null;

      const _onSuccess = wasUpdated => {
        expect(wasUpdated).to.equal(true);
        expect(self.image.status).to.equal(eImageStatus.creatingInvoices);
        expect(self.image.nextTask.task).to.not.exist;
        expect(self.image.comment).to.equal(ModelFactory.imageDoneWithoutTags.comment);
        expect(self.image.clientUrl).to.equal(ModelFactory.imageDoneWithoutTags.clientUrl);
        expect(self.image.updatedAt).to.not.equal(null);

        done();
      };

      ImageModel.create(ModelFactory.imageDoneWithoutTags)
        .then((image) => self.image = image)
        .then(() => ImageModel.updateStatus(self.image, self.userWithoutTagsDoc.id, eImageStatus.creatingInvoices, null, null))
        .then(_onSuccess)
        .catch(done);
    });

    it('should return true if image status was creatingInvoices and saved as done', (done) => {
      self.image = null;

      const _onSuccess = wasUpdated => {
        expect(wasUpdated).to.equal(true);
        expect(self.image.status).to.equal(eImageStatus.done);
        expect(self.image.nextTask.task).to.not.exist;
        expect(self.image.comment).to.equal(ModelFactory.imageCreatingInvoicesWithoutTags.comment);
        expect(self.image.clientUrl).to.equal(ModelFactory.imageCreatingInvoicesWithoutTags.clientUrl);
        expect(self.image.updatedAt).to.not.equal(null);

        done();
      };

      ImageModel.create(ModelFactory.imageCreatingInvoicesWithoutTags)
        .then((image) => self.image = image)
        .then(() => ImageModel.updateStatus(self.image, self.userWithoutTagsDoc.id, eImageStatus.done, null, null))
        .then(_onSuccess)
        .catch(done);
    });

    it('should return true and update status if userId is undefined', (done) => {
      const _onSuccess = wasUpdated => {
        expect(wasUpdated).to.equal(true);
        expect(self.image.status).to.equal(eImageStatus.waitingTask);
        expect(self.image.clientUrl).to.exist;
        expect(self.image.doneByUser).to.not.exist;
        expect(self.image.doneAt).to.exist;
        expect(self.image.updatedAt).to.exist;

        done()
      };

      ImageModel.create(ModelFactory.imageCreatingInvoicesWithoutTags)
        .then((image) => self.image = image)
        .then(() => ImageModel.updateStatus(self.image, undefined, eImageStatus.waitingTask, null, null))
        .then(_onSuccess)
        .catch(done);
    });

    it('should reject when userId is not an ObjectId', (done) => {
      ImageModel.updateStatus(self.image, "foo", eImageStatus.waitingTask, null, null)
        .catch((err) => {
          done();
        });
    });

    // TODO: test promise.reject with stub
  });
});
