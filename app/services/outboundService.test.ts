import { ConfigService } from './configService';
import * as ModelFactory from '../helpers/tests/modelFactory'
import ImageModel from "../models/image/image.model";
import {eImageTask} from "../models/image/image.model.interface";
import {OutboundService} from './outboundService';
import {expect} from 'chai';
import * as sinon from 'sinon';
import { DBService } from './dbService';

const TASKS_CONFIG = ConfigService.getConfig('tasks')
if (!TASKS_CONFIG){
  throw new Error("Couldn't found 'tasks' field in config")
}

describe('OutboundService', () => {
  let self = this;

  describe('.startTasksWatcher', () => {
    beforeEach((done) => {
      self.delayStub = sinon.stub(OutboundService, "delay").callsFake( () => Promise.resolve() );

      DBService.clearDB()
        .then(done)
    });

    afterEach((done) => {
      self.delayStub.restore();
      
      DBService.clearDB()
      .then(done)
    });

    it('should done with no resolved value when no image with waiting task found', (done) => {
       OutboundService.startTasksWatcher(false)
         .then((retValue) => {
           expect(retValue).to.not.exist;
           expect(self.delayStub.calledOnce).to.equal(true);
           done();
         });
    });

    it('should done with no resolved value when have image with waiting task', (done) => {
      ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageNeedImaginaryConversion, {
        imaginaryId: "img1",
        nextTask: {lastRetry: ModelFactory.Factory.subtractMinutesFromNowToDate(TASKS_CONFIG.retryIntervalMin + 1), retries: 1, task: eImageTask.processComplete}
      }))
      .then(() => {
        OutboundService.startTasksWatcher(false)
          .then((retValue) => {
            expect(retValue).to.not.exist;
            expect(self.delayStub.called).to.equal(false);
            done();
          });
      })
      .catch(done)
    })

    it('should reject with error message when ImageModel.nextWaitingTask() is rejecting', (done) => {
      self.nextWaitingTaskStub = sinon.stub(ImageModel, "nextWaitingTask").callsFake(() => {
        return Promise.reject("message from ImageModel.nextWaitingTask()");
      });

      OutboundService.startTasksWatcher(false)
        .catch((retValue) => {
          expect(retValue).to.exist;
          expect(self.delayStub.called).to.equal(false);
          expect(self.nextWaitingTaskStub.calledOnce).to.equal(true);
          self.nextWaitingTaskStub.restore();
          done();
        });
    });
  });
});

