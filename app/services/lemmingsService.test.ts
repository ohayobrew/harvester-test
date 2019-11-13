const nock = require('nock');
const {expect} = require('chai');

//TODO: move to another config structure
import * as path from 'path';
import {ICropArea} from '../models/image/image.model.interface';
import {LemmingsService, LemmingsUsersInfoRes} from "./lemmingsService";
let configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
let Config = require(configFilePath) || {};

let IMAGINARY_HOST = `${Config.lemmingsApi.host}${Config.lemmingsApi.apiPath}`;

const USERS_1_INFO: LemmingsUsersInfoRes = {
  notFound: [],
  found: [{
    _id: "123",
    email: "foo@bar.com",
    firstName: "Foo",
    lastName: "Bar",
    active: true
  }]
};

const USERS_1_INFO_EMPTY = {
  notFound: [],
  found: []
};

describe('Lemmings Service API', () => {
  describe('.getUsers', () => {
    it('promise should return user info successfully when 200 returned', (done) => {
      nock(IMAGINARY_HOST)
        .post(`${Config.lemmingsApi.userIdsApi}`, [USERS_1_INFO.found[0]._id])
        .matchHeader("CallingServer", Config.serviceName)
        .matchHeader("Vatbox-User-Id", "validUserId")
        .reply(200, USERS_1_INFO);

      LemmingsService.getUsers("validUserId", [USERS_1_INFO.found[0]._id])
        .then((returnVal) => {
          expect(returnVal.found[0]._id).to.equal(USERS_1_INFO.found[0]._id);
          done();
        })
        .catch(done);
    });

    it('promise should reject with error when 400 returned', (done) => {
      nock(IMAGINARY_HOST)
        .post(`${Config.lemmingsApi.userIdsApi}`, ["notExpectedText"])
        .reply(400, "Invalid request format");

      LemmingsService.getUsers("validUserId", ["notExpectedText"])
        .catch((returnVal) => {
          expect(returnVal.message).to.exist.and.contain("Failed to fetch users info from Lemmings service");
          done();
        })
        .catch(done);
    });

    it('promise should reject with error when 404 returned', (done) => {
      nock(IMAGINARY_HOST)
        .post(`${Config.lemmingsApi.userIdsApi}`, [USERS_1_INFO.found[0]._id])
        .reply(404, "Not found");

      LemmingsService.getUsers("validUserId", [USERS_1_INFO.found[0]._id])
        .catch((returnVal) => {
          expect(returnVal.message).to.exist.and.contain("Lemmings service error");
          done();
        })
        .catch(done);
    });

    it('promise should fail if image not found', (done) => {
      nock(IMAGINARY_HOST)
        .post(`${Config.lemmingsApi.userIdsApi}`, ["valid_id"])
        .reply(200, USERS_1_INFO_EMPTY);

      LemmingsService.getUsers("validUserId", ["valid_id"])
        .then((returnVal) => {
          expect(returnVal.found).to.exist.and.lengthOf(0);
          expect(returnVal.notFound).to.exist.and.lengthOf(0);
          done();
        })
        .catch(done);
    });
  });

});
