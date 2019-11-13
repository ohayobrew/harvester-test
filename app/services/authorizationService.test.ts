import {AuthorizationService} from './authorizationService';
const nock = require('nock');
const {expect} = require('chai');
import BaseTest from "../helpers/tests/base";

//TODO: move to another config structure
import * as path from 'path';
import {ICropArea} from '../models/image/image.model.interface';
import {LemmingsUsersInfoRes} from "./lemmingsService";
let configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
let Config = require(configFilePath) || {};

let KRANG_HOST = `${Config.krangApi.host}${Config.krangApi.apiPath}`;

const USER_1 = {
  vatboxUserId: "foo",
  activity: "myActivity"
};

describe('Authorization Service API', () => {
  after(() => {
    BaseTest.cleanNock();
  });

  describe('.isPermittedUser', () => {
    beforeEach(() => {
      BaseTest.cleanNock();
    });

    it('should resolve with true when 200 and {can: true} returned', (done) => {
      nock(KRANG_HOST)
        .get(`${Config.krangApi.permissionApi}?actionName=${Config.serviceName}::${USER_1.activity}`)
        .matchHeader("Vatbox-User-Id", USER_1.vatboxUserId)
        .reply(200, {can: true});

      AuthorizationService.isPermittedUser(USER_1.vatboxUserId, USER_1.activity)
        .then((returnVal) => {

          expect(returnVal).to.equal(true);
          done();
        })
        .catch(done);
    });

    it('should resolve with true when 200 returned when calling behalf of another service', (done) => {
      nock(KRANG_HOST)
        .get(`${Config.krangApi.permissionApi}?actionName=${Config.serviceName}::${USER_1.activity}`)
        .matchHeader("CallingServer", "myService")
        .reply(200, {can: true});

      AuthorizationService.isPermittedUser(USER_1.vatboxUserId, USER_1.activity, "myService")
        .then((returnVal) => {

          expect(returnVal).to.equal(true);
          done();
        })
        .catch(done);
    });

    // it('should resolve with false when 403 and {can: false} returned', (done) => {
    //   BaseTest.cleanNock();
    //   nock(KRANG_HOST)
    //     .get(`${Config.krangApi.permissionApi}?actionName=${Config.serviceName}::${USER_1.activity}`)
    //     .reply(403, {can: false});

    //   AuthorizationService.isPermittedUser(USER_1.vatboxUserId, USER_1.activity)
    //     .then((returnVal) => {

    //       expect(returnVal).to.equal(false);
    //       done();
    //     })
    //     .catch(done);
    // });

    // it('should reject with error when getting unhandled status code (like 204 - not in definition)', (done) => {
    //   nock(KRANG_HOST)
    //     .get(`${Config.krangApi.permissionApi}?actionName=${Config.serviceName}::${USER_1.activity}`)
    //     .reply(204);

    //   AuthorizationService.isPermittedUser(USER_1.vatboxUserId, USER_1.activity)
    //     .catch((returnVal) => {

    //       expect(returnVal.message).to.exist.and.contain("Unhandled status");
    //       done();
    //     })
    //     .catch(done);
    // });

    it('should reject when vatboxUserId is undefined', (done) => {
      AuthorizationService.isPermittedUser(undefined, USER_1.activity)
        .catch((returnVal) => {
          expect(returnVal).to.exist.and.contain("No vatboxUserId");

          done();
        })
        .catch(done);
    });

    it('should reject when activity is empty string', (done) => {
      AuthorizationService.isPermittedUser(USER_1.vatboxUserId, "")
        .catch((returnVal) => {
          expect(returnVal).to.exist.and.contain("No vatboxUserId");

          done();
        })
        .catch(done);
    });
  });

});
