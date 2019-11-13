import * as request from 'supertest';
import {DBService} from '../../../../services/dbService'
import FeatureService from '../service/feature.service';
import BaseTest from '../../../../helpers/tests/base';

var app = require('../../../../server');

describe('Feature Flag routes integration v1.0', () => {
  
  before((done) => {
    BaseTest.authorizeAll();
    done()
  });

  after((done) => {
    BaseTest.cleanNock();
    done()
  });

  describe('GET <base-path>/feature', () => {
    beforeEach((done) => {
      DBService.clearDB()
      .then(() => FeatureService.create('some-feature'))
      .then(() => done())
      .catch(done)
    });
  
    it('should return 200 and list of features as json', (done) => {
      request(app)
        .get('/api/exposed/v1.0/feature')
        .set('VATBOX-USER-ID', 'foo')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200, done);
    });
  
  });

  describe('GET <base-path>/feature/:id', () => {
    var self = this

    before((done) => {
      DBService.clearDB()
        .then(() => FeatureService.create('some-feature'))
        .then((feature) => self.feature = feature)
        .then(() => done())
        .catch(done)
    });
  
    it('should return 200 and feature as json', (done) => {
      request(app)
        .get(`/api/exposed/v1.0/feature/${self.feature.id}`)
        .set('VATBOX-USER-ID', 'foo')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200, done);
    });

    it('should return 400 feature not found', (done) => {
      request(app)
        .post(`/api/exposed/v1.0/feature/${self.feature.id}-1`)
        .set('VATBOX-USER-ID', 'foo')
        .set('Accept', 'application/json')
        .send({isOn: true})
        .expect(400, done);
    });
  })

  describe('POST <base-path>/feature/:id', () => {
    var self = this

    before((done) => {
      DBService.clearDB()
        .then(() => FeatureService.create('some-feature'))
        .then((feature) => self.feature = feature)
        .then(() => done())
        .catch(done)
    });

    it('should return 200 and updated feature as json', (done) => {
      request(app)
        .post(`/api/exposed/v1.0/feature/${self.feature.id}`)
        .set('VATBOX-USER-ID', 'foo')
        .set('Accept', 'application/json')
        .send({isOn: true})
        .expect('Content-Type', /json/)
        .expect(200, done);
    });

    it('should return 400 feature not found', (done) => {
      request(app)
        .post(`/api/exposed/v1.0/feature/${self.feature.id}-1`)
        .set('VATBOX-USER-ID', 'foo')
        .set('Accept', 'application/json')
        .send({isOn: true})
        .expect(400, done);
    });
  });
});