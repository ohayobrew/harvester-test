import * as request from 'supertest';

const { expect } = require('chai');
import BaseTest from '../../../../helpers/tests/base';
import * as sinon from 'sinon';
const app = require('../../../../server');
import {ImaginaryService} from "../../../../services/imaginaryService";
import * as ModelFactory from '../../../../helpers/tests/modelFactory'
import ImageModel from '../../../../models/image/image.model';
import {IImageModel} from "../../../../models/image/image.model.interface";
import {eImageStatus} from "../../../../models/image/image.model.interface";
import UserModel from '../../../../models/user/user.model';
import * as _ from 'lodash';
import ImageService from '../service/imageService'
import { DBService } from '../../../../services/dbService';
import {ImageController} from '../controller/image.controller'

describe('Image routes integration v1.0', () => {
  before(() => {
    BaseTest.authorizeAll();
  });

  after((done) => {
    BaseTest.cleanNock();
    DBService.clearDB().then(done);
  });

  describe('GET <base-path>/image', () => {
    before((done) => {
      DBService.clearDB().then(done);
    });

    it('should return 204 and no content when no images matching', (done) => {
      request(app)
        .get('/api/exposed/v1.0/image')
        .set('VATBOX-USER-ID', 'foo')
        .set('Accept', 'application/json')
        .expect(204, "", done);
    });

    it('should return 200 and serialized image as json', (done) => {
      ImageModel.create(ModelFactory.imageInProgressWithoutTags)
        .then((image) => {
          request(app)
            .get('/api/exposed/v1.0/image')
            .set('VATBOX-USER-ID', 'foo')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200, done);
        })
    });

    it('should set status to 401 if VATBOX-USER-ID header is empty', (done) => {
      request(app)
        .get('/api/exposed/v1.0/image')
        .set('Accept', 'application/json')
        .expect(401, "No VATBox User ID header supplied", done);
    });

    // it('should return 403 when authorization service return 403', (done) => {
    //   BaseTest.cleanNock();
    //   nock(AuthorizationService.permissionApi)
    //     .persist()
    //     .get("")
    //     .query(function(actualQueryObject){
    //       return true;
    //     })
    //     .reply(403);

    //   request(app)
    //     .get('/api/exposed/v1.0/image')
    //     .set('VATBOX-USER-ID', 'foo')
    //     .set('Accept', 'application/json')
    //     .expect(403)
    //     .end((err, res) => {
    //       // re-initialize mock authorize all
    //       BaseTest.cleanNock();
    //       BaseTest.authorizeAll();

    //       done(err);
    //     });
    // });
  });

  describe('GET <base-path>/image/:imageId', () => {
    before((done) => {
      // BaseTest.authorizeAll();
      DBService.clearDB().then(done);
    });

    it('should return 400 and no content when image not found', (done) => {
      request(app)
        .get('/api/exposed/v1.0/image/fakeId')
        .set('VATBOX-USER-ID', 'foo')
        .set('Accept', 'application/json')
        .expect(400, "", done);
    });

    it('should return 200 and serialized image as json', (done) => {
      ImageModel.create(ModelFactory.imageInProgressWithoutTags)
        .then((image) => {
          request(app)
            .get('/api/exposed/v1.0/image/' + image.id)
            .set('VATBOX-USER-ID', 'foo')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200, done);
        })
    });

    it('should set status to 401 if VATBOX-USER-ID header is empty', (done) => {
      request(app)
        .get('/api/exposed/v1.0/image/fakeId')
        .set('Accept', 'application/json')
        .expect(401, "No VATBox User ID header supplied", done);
    })
  });

  describe('GET <base-path>/image/entity/:entityId', () => {
    before((done) => {
      DBService.clearDB().then(done);
    });

    it('should return 204 and no content when no images matching and requesting by entityId', (done) => {
      request(app)
        .get('/api/exposed/v1.0/image/entity/fakeId')
        .set('VATBOX-USER-ID', 'foo')
        .set('Accept', 'application/json')
        .expect(204, "", done);
    });

    it('should return 200 and serialized image as json', (done) => {
      ImageModel.create(ModelFactory.imageInProgressWithoutTags)
        .then((image) => {
          request(app)
            .get('/api/exposed/v1.0/image/entity/' + image.entityId)
            .set('VATBOX-USER-ID', 'foo')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200, done);
        })
    });

    it('should set status to 401 if VATBOX-USER-ID header is empty', (done) => {
      request(app)
        .get('/api/exposed/v1.0/image/entity/fakeId')
        .set('Accept', 'application/json')
        .expect(401, "No VATBox User ID header supplied", done);
    })
  });

  describe('POST <base-path>/image/:imageId/single', () => {
    let self = this;

    beforeEach((done) => {
      DBService.clearDB()
      .then(() => Promise.all([ImageModel.create(ModelFactory.imageInProgressWithoutTags), UserModel.createUser(ModelFactory.userWithInhouseTag)]))
      .then(([image, user]) => {
        self.image = image;
        self.user = user;
        done();
      })
      .catch(done);
    });
    
    afterEach( (done) => {
      self.imagePostSingleImageStub.restore()
      done()
    })

    it('should return 200 for single image', (done) => {
      self.imagePostSingleImageStub = sinon.stub(ImageService, "completeAsSingleImage")
                                  .callsFake(() => Promise.resolve('success'));
      request(app)
        .post(`/api/exposed/v1.0/image/${self.image.id}/single`)
        .set('VATBOX-USER-ID', self.user.vatboxUserId)
        .set('Accept', 'application/json')
        .send()
        .expect(200, {}, done);
    });
  })

  describe('POST <base-path>/image/:imageId/area', () => {
    let self = this;

    beforeEach((done) => {
      DBService.clearDB()
      .then(() => UserModel.createUser(ModelFactory.userWithInhouseTag))
      .then((user) => {
        self.userWithInhouseTag = user;
        done();
      })
      .catch(done);
    });

    it('should return 400 and no content when image not found', (done) => {
      request(app)
        .post('/api/exposed/v1.0/image/fakeId/area')
        .set('VATBOX-USER-ID', 'foo')
        .set('Accept', 'application/json')
        .send(ModelFactory.cropAreaRequestBody1)
        .expect(400, "", done);
    });

    it('should return 200 and serialized image as json', (done) => {
      let imageJson: IImageModel = _.cloneDeep(ModelFactory.imageInProgressWithoutTags);
      imageJson.activeUser = self.userWithInhouseTag.id;
      ImageModel.create(imageJson)
        .then((image) => {
          request(app)
            .post('/api/exposed/v1.0/image/' + image.id + '/area')
            .set('VATBOX-USER-ID', self.userWithInhouseTag.vatboxUserId)
            .set('Accept', 'application/json')
            .send(ModelFactory.cropAreaRequestBody1)
            .expect('Content-Type', /json/)
            .expect(200)
            .end((err, res) => {
              // check returned id is a legal ObjectId
              expect(res.body.id).to.exist.and.to.match(/^[0-9a-fA-F]{24}$/);
              done();
            });
        })
    });

    it('should set status to 401 if VATBOX-USER-ID header is empty', (done) => {
      request(app)
        .post('/api/exposed/v1.0/image/fakeId/area')
        .set('Accept', 'application/json')
        .expect(401, "No VATBox User ID header supplied", done);
    })
  });

  describe('DELETE <base-path>/image/:imageId/area/:areaId', () => {
    before((done) => {
      DBService.clearDB().then(done);
    });

    it('should return 400 and no content when image or area not found', (done) => {
      let self = this;
      let _makeRequest = (imageId: string, areaId: string): Promise<void> => {
        return new Promise((resolve, reject) => {
          request(app)
            .delete('/api/exposed/v1.0/image/' + imageId + '/area/' + areaId)
            .set('VATBOX-USER-ID', 'foo')
            .set('Accept', 'application/json')
            .expect(400)
            .end((err, res) => {
              resolve();
            });
        });
      };

      ImageModel.create(ModelFactory.imageInProgressWithoutTags)
        .then((image) => self.image = image)
        .then(() => _makeRequest("foo", "bar")) // not objectId
        .then(() => _makeRequest(ModelFactory.objectId1, ModelFactory.objectId2)) // both not exist
        .then(() => _makeRequest(self.image.id, ModelFactory.objectId2)) // cropArea not exist for image
        .then(() => done())
        .catch(done);
    });

    it('should return 200 when cropArea deleted successfully', (done) => {
      let self = this;

      ImageModel.create(ModelFactory.imageInProgressWithoutTags)
        .then((image) => self.image = image)
        .then(() => self.image.createCropArea(ModelFactory.objectId1, ModelFactory.cropAreaRequestBody1))
        .then((cropArea) => {
          self.cropArea = cropArea;

          request(app)
            .delete('/api/exposed/v1.0/image/' + self.image.id + '/area/' + self.cropArea._id)
            .set('VATBOX-USER-ID', 'foo')
            .set('Accept', 'application/json')
            .expect(200,"" , done);
        })
        .catch(done);
    })

    it('should set status to 401 if VATBOX-USER-ID header is empty', (done) => {
      request(app)
        .delete('/api/exposed/v1.0/image/foo/area/bar')
        .set('Accept', 'application/json')
        .expect(401, "No VATBox User ID header supplied", done);
    })
  });

  describe('POST <base-path>/image/:imageId/action/:verb', () => {
    let self = this;

    beforeEach((done) => {
      DBService.clearDB().then(done);
      // stubbing .complete, don't need to be tested since it is done async after returning response
      //self.imageIntegrationsStub =  sinon.stub(ImageIntegrations, "complete").callsFake(() => { return Promise.resolve(null) });
    });

    afterEach((done) =>{
      //self.imageIntegrationsStub.restore();
      done();
    });

    var _doSuccessfulRequest = (verb: string, image: IImageModel, comment: string, clientUrl: string, done) => {
      request(app)
        .post('/api/exposed/v1.0/image/' + image.id + '/action/' + verb)
        .set('VATBOX-USER-ID', 'foo')
        .send({comment: comment, clientUrl: clientUrl})
        .set('Accept', 'application/json')
        .expect(200)
        .end((err, res) => {
          ImageModel.findById(image.id)
            .then((savedImage) => {
              expect(savedImage.comment).to.equal(comment);
              expect(savedImage.clientUrl).to.equal(clientUrl);
              //if (verb === "done")
              //  expect(self.imageIntegrationsStub.notCalled).to.equal(true);
              //else
              //  expect(self.imageIntegrationsStub.called).to.equal(false);
              done();
            });

        })
    };

    var _doFailingRequest = (verb: string, image: IImageModel, done) => {
      request(app)
        .post('/api/exposed/v1.0/image/' + image.id + '/action/' + verb)
        .set('VATBOX-USER-ID', 'foo')
        .set('Accept', 'application/json')
        .expect(400)
        .end((err, res) => {
          //expect(self.imageIntegrationsStub.called).to.equal(false);
          done();
        })
    };

    it('should return 200 when status changed successfully from inProgress to done', (done) => {
      ImageModel.create(ModelFactory.imageInProgressWithoutTagsWithCropAreas)
        .then((image) => {
          _doSuccessfulRequest("done", image, "new comment", "clientUrl", done);
        })
        .catch(done);
    });

    it('should return 200 when status changed successfully from rejected to done', (done) => {
      ImageModel.create(ModelFactory.imageRejectedWithoutTagsWithCropAreas)
        .then((image) => {
          _doSuccessfulRequest("done", image, "new comment", "clientUrl", done);
        })
        .catch(done);
    });

    it('should return 200 when status changed successfully from inProgress to rejected', (done) => {
      ImageModel.create(ModelFactory.imageInProgressWithoutTags)
        .then((image) => {
          _doSuccessfulRequest("reject", image, "new comment", "clientUrl", done);
        })
        .catch(done);
    });

    it('should reject with status 400 when sending complete done to image with status done', (done) => {
      ImageModel.create(ModelFactory.imageDoneWithoutTags)
        .then((image) => {
          _doFailingRequest("done", image, done);
        })
        .catch(done);
    });

    it('should return 200 when status changed successfully from rejected to rejected', (done) => {
      ImageModel.create(ModelFactory.imageRejectedWithoutTags)
        .then((image) => {
          _doSuccessfulRequest("reject", image, "new comment", "clientUrl", done);
        })
        .catch(done);
    });

    it('should return 400 when status was not changed from done to rejected', (done) => {
      ImageModel.create(ModelFactory.imageDoneWithoutTags)
        .then((image) => {
          _doFailingRequest("reject", image, done);
        })
        .catch(done);
    });

    it('should return 400 when image doent have cropAreas', (done) => {
      ImageModel.create(ModelFactory.imageDoneWithoutTags)
        .then((image) => {
          _doFailingRequest("done", image, done);
        })
        .catch(done);
    });

    it('should return 400 when status was not legal', (done) => {
      ImageModel.create(ModelFactory.imageDoneWithoutTags)
        .then((image) => {
          _doFailingRequest("bar", image, done);
        })
        .catch(done);
    });

    it('should return 400 when verb was unsupported status', (done) => {
      ImageModel.create(ModelFactory.imageDoneWithoutTags)
        .then((image) => {
          _doFailingRequest("inProgress", image, done);
        })
        .catch(done);
    });

    it('should return 400 when image found', (done) => {
      request(app)
            .post('/api/exposed/v1.0/image/' + ModelFactory.objectId1 + '/action/done')
            .set('VATBOX-USER-ID', 'foo')
            .set('Accept', 'application/json')
            .expect(400,"" , done);
    });

    it('should set status to 401 if VATBOX-USER-ID header is empty', (done) => {
      request(app)
        .post('/api/exposed/v1.0/image/foo/action/done')
        .set('Accept', 'application/json')
        .expect(401, "No VATBox User ID header supplied", done);
    })
  });

  describe('GET <base-path>/images/<query-params>', () => {
    beforeEach((done) => {
      DBService.clearDB().then(done);
    });

    const _doRequest = (query: string, limit: string, offset: string, expectedCode: number, expectedTotal: number, done) => {
      request(app)
        .get('/api/exposed/v1.0/images')
        .query(query + '&limit=' + limit + '&offset=' + offset)
        .set('VATBOX-USER-ID', 'foo')
        .set('Accept', 'application/json')
        .expect(expectedCode)
        .end((err, res) => {
          if (expectedTotal == null)
            expect(res.body).to.be.empty;
          else {
            expect(res.body).to.exist
              .and.to.have.property("total")
              .and.to.equal(expectedTotal);
          }

          done(err);
        });
    };

    it('should return 200 status and have results when query succeeding', (done) => {
      let query = 'status=' + eImageStatus.rejected + '&entityId=' + ModelFactory.imageRejectedWithoutTags.entityId;
      // let query = 'status=rejected' + '&entityId=' + ModelFactory.imageRejectedWithoutTags.entityId;

      ImageModel.create(ModelFactory.imageRejectedWithoutTags)
        .then((image) => {
          _doRequest(query, "10", "0", 200, 1, done);
        })
        .catch(done);
    });

    it('should return 200 status and have results when query succeeding with one param', (done) => {
      var query = 'status=' + eImageStatus.rejected;

      ImageModel.create(ModelFactory.imageRejectedWithoutTags)
        .then((image) => {
          _doRequest(query, "10", "0", 200, 1, done);
        })
        .catch(done);
    });

    it('should return 204 if no results found', (done) => {
      var query = 'entityId=1234567';

      ImageModel.create(ModelFactory.imageRejectedWithoutTags)
        .then((image) => {
          _doRequest(query, "10", "0", 204, null, done);
        })
        .catch(done);
    });

    it('should return 400 if no params supplied', (done) => {
      var query = '';

      ImageModel.create(ModelFactory.imageRejectedWithoutTags)
        .then((image) => {
          _doRequest(query, "10", "0", 400, null, done);
        })
        .catch(done);
    });

    it('should return 400 if limit value is not a number', (done) => {
      var query = 'status=' + eImageStatus[eImageStatus.rejected];

      ImageModel.create(ModelFactory.imageRejectedWithoutTags)
        .then((image) => {
          _doRequest(query, "foo", "0", 400, null, done);
        })
        .catch(done);
    });

    it('should return 400 if status is not an existing one', (done) => {
      var query = 'status=bar';

      ImageModel.create(ModelFactory.imageRejectedWithoutTags)
        .then((image) => {
          _doRequest(query, "10", "0", 400, null, done);
        })
        .catch(done);
    });
  });

  describe('POST <base-path>/images', () => {
    var self = this;

    beforeEach((done) => {
      DBService.clearDB().then(() => {
        self.imaginaryGetInfoConvertedStub = sinon.stub(ImaginaryService, "getInfoConverted").callsFake(() => {
          return Promise.resolve(self.returnImageInfoValue)
        });
        done();
      });
    });

    afterEach(() => {
      self.imaginaryGetInfoConvertedStub.restore();
    });

    var _doRequest = (requestBody: any, expectedCode: number, done) => {
      request(app)
        .post('/api/exposed/v1.0/images')
        .send(requestBody)
        .set('VATBOX-USER-ID', 'foo')
        .set('Accept', 'application/json')
        .expect(expectedCode)
        .end((err, res) => {
          done(err);
        });
    };

    it('should return 201 status when image created successfully', (done) => {
      self.returnImageInfoValue = {id: ModelFactory.objectId1};

      let requestBody = {
        metadata: {
          workloadId: "workloadId",
          reportId: "reportId",
          companyId: ModelFactory.objectId2,
          transactionId: "transactionId"
        },
        data: {
          imageId: ModelFactory.objectId1,
          entityId: ModelFactory.objectId2,
          tags: ModelFactory.imageInProgress1.tags,
          source: "test",
          reportId: "reportId"
        }
      };

      _doRequest(requestBody, 201, done);
    });

    it('should return 400 status when missing request parameters', (done) => {
      var requestBody = {
        metadata: {},
        data: {
          entityId: ModelFactory.objectId2,
          tags: ModelFactory.imageInProgress1.tags
        }
      };

      _doRequest(requestBody, 400, done);
    });
  });

  describe('GET <base-path>/images/report/entities/statuses', () => {
    var self = this;

    before((done) => {
      DBService.clearDB()
        .then(() => done() );
    });

    afterEach(() => {
      self.reportStub.restore();
    });

    var _doRequest = (expectedCode: number, done) => {
      request(app)
        .get('/api/exposed/v1.0/images/report/entities/statuses')
        .set('VATBOX-USER-ID', 'foo')
        .expect(expectedCode)
        .end((err, res) => {
          done(err);
        });
    };

    it('should return 200 status when entity counters was calculated', (done) => {
      self.reportStub = sinon.stub(ImageModel, "reportByEntitiesStatuses").callsFake(() => {
        return Promise.resolve([])
      });

      _doRequest(200, done);
    });

    it('should return 204 status when no counters was calculated', (done) => {
      self.reportStub = sinon.stub(ImageModel, "reportByEntitiesStatuses").callsFake(() => {
        return Promise.resolve(null)
      });

      _doRequest(204, done);
    });
  });

  describe('GET <base-path>/images/report/entities/', () => {
    var self = this;

    before((done) => {
      DBService.clearDB()
        .then(() => done() );
    });

    afterEach(() => {
      self.reportStub.restore();
    });

    var _doRequest = (expectedCode: number, done) => {
      request(app)
        .get('/api/exposed/v1.0/images/report/entities/performance')
        .query({fromDate: ModelFactory.Factory.subtractMinutesFromNowToDate(10), toDate: new Date()})
        .set('VATBOX-USER-ID', 'foo')
        .expect(expectedCode)
        .end((err, res) => {
          done(err);
        });
    };

    it('should return 200 status when entity counters was calculated', (done) => {
      self.reportStub = sinon.stub(ImageModel, "reportByEntities").callsFake(() => {
        return Promise.resolve([])
      });

      _doRequest(200, done);
    });

    it('should return 204 status when no counters was calculated', (done) => {
      self.reportStub = sinon.stub(ImageModel, "reportByEntities").callsFake(() => {
        return Promise.resolve(null)
      });

      _doRequest(204, done);
    });
  });

  describe('GET <base-path>/images/failure', () => {
    var self = this;

    it('should return 200 status on get request', (done) => {
      self.getImagesStatusErrorCountStub = sinon.stub(ImageController, "getImagesStatusErrorCount").callsFake(() => {
        return Promise.resolve({count: 1})
      });

      request(app)
        .get('/api/exposed/v1.0/images/failure/count')
        .set('VATBOX-USER-ID', 'foo')
        .expect(200)
        .end((err, res) => {
          self.getImagesStatusErrorCountStub.restore()
          done(err);
        });
    });

    it('should return 200 status on post request', (done) => {
      self.retryFailureImagesStub = sinon.stub(ImageController, "retryFailureImages").callsFake(() => {
        return Promise.resolve({count: 1})
      });

      request(app)
        .post('/api/exposed/v1.0/images/failure/reset')
        .set('VATBOX-USER-ID', 'foo')
        .expect(200)
        .end((err, res) => {

          self.retryFailureImagesStub.restore()
          done(err);
        });
    });
  });
})

// TODO: define baseUrl for express router
