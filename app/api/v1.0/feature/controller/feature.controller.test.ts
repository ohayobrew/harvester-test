import { FeatureFlagModel } from './../../../../models/featureFlagModel/featureFlagModel.model';
import * as sinon from 'sinon';
const {expect} = require('chai');
import {DBService} from '../../../../services/dbService'

import FeatureService from '../service/feature.service';
import { FeatureController } from './feature.controller';

let self = this;

let getReqObj = () => {
  return {
    query: {},
    params: {},
    body: {}
  }
}

let getResSpy = () => {
  return {
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
  }
}

let initSpyFunctions = () => {
  self.statusSpy = sinon.spy();
  self.sendSpy = sinon.spy();
  self.jsonSpy = sinon.spy();
}

self.initSpyAndStub = () => {
  self.req = getReqObj()
  self.req.body = {
    user: { model: {}}
  }

  self.req.header = (status) => {}
  self.res = getResSpy()
  initSpyFunctions()

};

// Unit tests for routing inner logic
describe('Feature Flag Controller v1.0', () => {

  describe('.getList', () => {
    
    beforeEach((done) => {
      self.initSpyAndStub()
      self.getListStub = sinon.stub(FeatureService, 'getList').callsFake(() => self.getListResult)
      DBService.clearDB().then(done);
    });

    afterEach((done) => {
      self.getListStub.restore()
      done()
    });

    it('should set status to 200 if listing features flag successefully', (done) => {
      self.getListResult = Promise.resolve([])
  
      FeatureController.getList(self.req, self.res)
        .then((returnVal) => {
          expect(self.statusSpy.firstCall.args[0]).to.equal(200);
          expect(self.jsonSpy.firstCall.args[0]).to.be.instanceof(Array);
          done();
        })
        .catch(done)
    });

    it('should set status to 400 if listing features had error', (done) => {
      self.getListResult = Promise.resolve(null)
  
      FeatureController.getList(self.req, self.res)
        .then((returnVal) => {
          expect(self.statusSpy.firstCall.args[0]).to.equal(400);
          done();
        })
        .catch(done)
    });
  })

  describe('.getFeature', () => {
    
    beforeEach((done) => {
      self.initSpyAndStub()
      self.getFeatureByIdStub = sinon.stub(FeatureService, 'getFeatureById').callsFake(() => self.getFeatureByIdResult)
      DBService.clearDB().then(done);
    });

    afterEach((done) => {
      self.getFeatureByIdStub.restore()
      done()
    });

    it('should set status to 200 if get feature flag by id find feature successefully', (done) => {
      self.getFeatureByIdResult = Promise.resolve(new FeatureFlagModel("test"))
  
      self.req.params.id = "asdjkehwkd"
      FeatureController.getFeature(self.req, self.res)
        .then((returnVal) => {
          expect(self.statusSpy.firstCall.args[0]).to.equal(200);
          expect(self.jsonSpy.firstCall.args[0]).to.be.instanceof(FeatureFlagModel);
  
          done();
        })
        .catch(done)
    });

    it('should set status to 400 if get feature flag by id had error', (done) => {
      self.getFeatureByIdResult = Promise.reject('error')
  
      self.req.params.id = "asdjkehwkd"
      FeatureController.getFeature(self.req, self.res)
        .then((returnVal) => {
          expect(self.statusSpy.firstCall.args[0]).to.equal(400);
          done();
        })
        .catch(done)
    });
  })

  describe('.changeFeatureStatus', () => {
    
    beforeEach((done) => {
      self.initSpyAndStub()
      self.updateFeatureStatusStub = sinon.stub(FeatureService, 'updateFeatureStatus').callsFake(() => self.updateFeatureStatusResult)
      DBService.clearDB().then(done);
    });

    afterEach((done) => {
      self.updateFeatureStatusStub.restore()
      done()
    });

    it('should set status to 200 if change feature flag status updated successefully', (done) => {
      self.updateFeatureStatusResult = Promise.resolve(new FeatureFlagModel("test"))
  
      self.req.params.id = "asdjkehwkd"
      self.req.body.isOn = true
      FeatureController.changeFeatureStatus(self.req, self.res)
        .then((returnVal) => {
          expect(self.statusSpy.firstCall.args[0]).to.equal(200);
          expect(self.jsonSpy.firstCall.args[0]).to.be.instanceof(FeatureFlagModel);
  
          done();
        })
        .catch(done)
    });

    it('should set status to 400 if change feature flag status had error', (done) => {
      self.updateFeatureStatusResult = Promise.reject('error')
  
      self.req.params.id = "asdjkehwkd"
      FeatureController.changeFeatureStatus(self.req, self.res)
        .then((returnVal) => {
          expect(self.statusSpy.firstCall.args[0]).to.equal(400);
          done();
        })
        .catch(done)
    });
  })
});
