import * as request from 'supertest';
var expect = require('chai').expect;
import BaseTest from '../../../../helpers/tests/base';
import {DBService} from '../../../../services/dbService'

var app = require('../../../../server');

describe('Health routes integration v1.0', () => {
  
  beforeEach((done) => {
    DBService.clearDB().then(done);
  });


  describe('GET <base-internal-path>/health/liveness', () => {
    before((done) => {
      DBService.clearDB().then(done);
    });

    it('should return 200 when db is connected', (done) => {
      request(app)
        .get('/api/internal/v1.0/health/liveness')
        .expect(200, done);
    });

    it('should return 500 when db not connected', (done) => {
      DBService.disconnect()
        .then( () => {
          request(app)
            .get('/api/internal/v1.0/health/liveness')
            .expect(500)
            .end((err, res) => {
              DBService.connect()
                .then(() => done())
            })
        })
    });
  });

  describe('GET <base-internal-path>/health/readiness', () => {
    before((done) => {
      DBService.clearDB().then(done);
    });

    it('should return 200 when db is connected', (done) => {
      request(app)
        .get('/api/internal/v1.0/health/readiness')
        .expect(200, done);
    });

    it('should return 500 when db not connected', (done) => {
      DBService.disconnect()
              .then(() => {
                request(app)
                  .get('/api/internal/v1.0/health/readiness')
                  .expect(500)
                  .end((err, res) => {
                    DBService.connect()
                      .then(() => done());
                  })
              })
    });
  });
})

