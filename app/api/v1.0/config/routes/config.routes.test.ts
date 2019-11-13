import * as request from 'supertest';
import BaseTest from '../../../../helpers/tests/base';
import {DBService} from '../../../../services/dbService'
var app = require('../../../../server');


describe('Config routes integration v1.0', () => {

  before((done) => {
    DBService.clearDB().then(done);
  });

  after((done) => {
    DBService.clearDB().then(done);
  });

  describe('POST <base-path>/config/entityPriorities', () => {
    let self = this;

    before(() => {
      BaseTest.authorizeAll();
    });

    beforeEach((done) => {
      DBService.clearDB()
        .then(done)
        .catch(done);
    });

    after(() => {
      BaseTest.cleanNock();
    });

    it('should return 400 when not providing entity ids array', (done) => {
      request(app)
        .post('/api/exposed/v1.0/config/entityPriorities')
        .set('VATBOX-USER-ID', 'foo')
        .set('Accept', 'application/json')
        .send("")
        .expect(400, "no string array provided", done);
    });

    it('should return 400 when providing fault body', (done) => {
      request(app)
        .post('/api/exposed/v1.0/config/entityPriorities')
        .set('VATBOX-USER-ID', 'foo')
        .set('Accept', 'application/json')
        .send({k: "v"})
        .expect(400, "no string array provided", done);
    });

    it('should return 200 when saved ok (case 1: new config, case2: existing config)', (done) => {
      request(app)
        .post('/api/exposed/v1.0/config/entityPriorities')
        .set('VATBOX-USER-ID', 'foo')
        .set('Accept', 'application/json')
        .send(["entity1", "entity2"])
        .expect(200, "")
        .end((err, res) => {
          request(app)
            .post('/api/exposed/v1.0/config/entityPriorities')
            .set('VATBOX-USER-ID', 'foo')
            .set('Accept', 'application/json')
            .send(["entity2", "entity1"])
            .expect(200, "", done);
        });
    });

    it('should set status to 401 if VATBOX-USER-ID header is empty', (done) => {
      request(app)
        .post('/api/exposed/v1.0/config/entityPriorities')
        .set('Accept', 'application/json')
        .expect(401, "No VATBox User ID header supplied", done);
    })
  });
})

// TODO: define baseUrl for express router
