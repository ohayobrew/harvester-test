import { DBService } from './../../../../services/dbService';
import * as _ from 'lodash';
import BaseTest from '../../../../helpers/tests/base';
import * as sinon from 'sinon';
import ConfigService from "./config.service";
import {Deserializer} from "../../../../utils/deserializer";
import ConfigModel from "../../../../models/config/config.model";
var mongoose = require('mongoose');
var expect = require('chai').expect;

describe("Config Service v1.0", () => {
  
  before((done) => {
    DBService.clearDB().then(done);
  });

  describe(".setEntityPriorities", () => {
    
    beforeEach((done) => {
      
      DBService.clearDB()
        .then(done)
        .catch(done);
    });

    it("should return true when setting is ok", function (done) {
      let me = this;
      let entityIds: string[] = ["entity1", "entity2", "entity3"];
      let configModel: any = {setEntityPriorities: () => {} };

      me.deserializerEntityPrioritiesStub = sinon.stub(Deserializer, "entityPriorities").callsFake(() => []);
      me.configGetConfigStub = sinon.stub(ConfigModel, "getConfig").callsFake(() => Promise.resolve(configModel));
      me.configSetEntityPrioritiesStub = sinon.stub(configModel, "setEntityPriorities").callsFake(() => Promise.resolve(true));

      ConfigService.setEntityPriorities(entityIds)
        .then((retValue) => {
          expect(retValue).to.exist.and.equal(true);
          expect(me.deserializerEntityPrioritiesStub.calledOnce).to.equal(true);
          expect(me.configGetConfigStub.calledOnce).to.equal(true);
          expect(me.configSetEntityPrioritiesStub.calledOnce).to.equal(true);

          expect(me.deserializerEntityPrioritiesStub.getCall(0).args[0]).to.equal(entityIds);
          expect(me.configSetEntityPrioritiesStub.getCall(0).args[0]).to.equal(me.deserializerEntityPrioritiesStub.getCall(0).returnValue);

          me.deserializerEntityPrioritiesStub.restore();
          me.configGetConfigStub.restore();
          me.configSetEntityPrioritiesStub.restore();
          done();
        })
        .catch(done);
    });

    it("should reject if message.body could not be parsed", (done) => {
      let me = this;
      let configModel: any = {setEntityPriorities: () => {} };

      me.deserializerEntityPrioritiesStub = sinon.stub(Deserializer, "entityPriorities").callsFake(() => undefined);
      me.configGetConfigStub = sinon.stub(ConfigModel, "getConfig").callsFake(() => Promise.resolve(configModel));
      me.configSetEntityPrioritiesStub = sinon.stub(configModel, "setEntityPriorities").callsFake(() => Promise.resolve(true));

      ConfigService.setEntityPriorities(undefined)
        .catch((retValue) => {
          expect(retValue).to.exist.and.equal("No entity ids provided");
          expect(me.deserializerEntityPrioritiesStub.calledOnce).to.equal(true);
          expect(me.configGetConfigStub.calledOnce).to.equal(false);
          expect(me.configSetEntityPrioritiesStub.calledOnce).to.equal(false);

          expect(me.deserializerEntityPrioritiesStub.getCall(0).args[0]).to.equal(undefined);

          me.deserializerEntityPrioritiesStub.restore();
          me.configGetConfigStub.restore();
          me.configSetEntityPrioritiesStub.restore();
          done();
        })
        .catch(done);
    });
  })
});
