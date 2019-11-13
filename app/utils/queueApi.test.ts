import * as sinon from 'sinon';
import BaseTest from '../helpers/tests/base';
import {expect} from 'chai';
import * as aws from 'aws-sdk';
import {QueueApi, eQueues, IIncomingMessage, MessageHandlerCallback} from "./queueApi";

//TODO: move to another config structure
import * as path from 'path';
import { DBService } from '../services/dbService';
let configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
let Config = require(configFilePath) || {};

describe('Queue API', () => {
  let self = this;

  self.initGeneralStubs = () => {
    self.longPollQueueUrlStub = sinon.stub(QueueApi, "getLongPollQueueUrl").callsFake(() => {
      return Promise.resolve("fakeLongPollingUrl");
    });

    self.createDeadLettersQueueStub = sinon.stub(QueueApi, "createDeadLettersQueue").callsFake(() => {
      return Promise.resolve("deadLettersQueueArn");
    });

    self.getQueueUrlStub = sinon.stub(QueueApi.sqs, "getQueueUrl").callsFake((params: aws.SQS.Types.GetQueueUrlRequest, callback: (err: Error, data: { QueueUrl: string; }) => void) => {
      return callback(null, {QueueUrl: "http://blabla." + params.QueueName});
    });
  };

  self.restoreGeneralStubs = () => {
    self.longPollQueueUrlStub.restore();
    self.createDeadLettersQueueStub.restore();
    self.getQueueUrlStub.restore();
  };

  before((done) => {
    DBService.clearDB().then(done);
  });

  after((done) => {
    DBService.clearDB().then(done);
  });

  describe('.send', () => {
    beforeEach((done) => {
      self.initGeneralStubs();
      QueueApi.resetCachedConfig();

      self.sendMessageStub = sinon.stub(QueueApi.sqs, "sendMessage").callsFake((params: aws.SQS.Types.SendMessageRequest, callback: (err: Error, data: aws.SQS.SendMessageResult) => void) => {
        return callback(self.sendMessageStubReturnErr, self.sendMessageStubReturn);
      });

      done();
    });

    afterEach((done) => {
      self.restoreGeneralStubs();
      self.sendMessageStub.restore();
      done();
    });

    it('should resolve with message id if succeeded', (done) => {
      self.sendMessageStubReturn = {MessageId: "messageId123"};
      self.sendMessageStubReturnErr = null;

      QueueApi.send("my fake message", eQueues.expediteIn)
        .then((returnVal) => {
          expect(returnVal).to.equal("messageId123");
          done();
        })
        .catch(done);
    });

    it('should reject with error if failed', (done) => {
      self.sendMessageStubReturn = null;
      self.sendMessageStubReturnErr = {Err: "err"};

      QueueApi.send("my fake message", eQueues.expediteIn)
        .catch((returnVal) => {
          expect(returnVal).to.exist;
          done();
        });
    });

    it('should reject if failed to fetch queue url', (done) => {
      self.restoreGeneralStubs(); // this functionality does not needed here

      // fail in sqs.getQueueUrl - queue url will not be available
      self.getQueueUrlStub = sinon.stub(QueueApi.sqs, "getQueueUrl").callsFake((params: aws.SQS.Types.GetQueueUrlRequest, callback: (err: Error, data: { QueueUrl: string; }) => void) => {
        return callback({name: "ERROR", message: "err"}, null);
      });

      QueueApi.send("my fake message", eQueues.expediteIn)
        .catch((err) => {
          expect(err).to.exist;
          expect(self.getQueueUrlStub.calledOnce).to.equal(true);
          self.getQueueUrlStub.restore();
          done();
        });
    });
  });

  describe('.deleteMessage', () => {
    beforeEach((done) => {
      self.initGeneralStubs();
      QueueApi.resetCachedConfig();

      self.deleteMessageStub = sinon.stub(QueueApi.sqs, "deleteMessage").callsFake((params: aws.SQS.Types.DeleteMessageRequest, callback: (err: Error, data: any) => void) => {
        return callback(self.deleteMessageStubReturnErr, self.deleteMessageStubReturn);
      });

      done();
    });

    afterEach((done) => {
      self.restoreGeneralStubs();
      self.deleteMessageStub.restore();
      done();
    });

    it('should resolve if succeeded', (done) => {
      self.deleteMessageStubReturn = {};
      self.deleteMessageStubReturnErr = null;

      QueueApi.deleteMessage("fake receiptHandle", eQueues.expediteIn)
        .then((returnVal) => {
          expect(returnVal).to.exist;
          done();
        })
        .catch(done);
    });

    it('should reject with error if failed', (done) => {
      self.deleteMessageStubReturn = null;
      self.deleteMessageStubReturnErr = {Err: "err"};

      QueueApi.deleteMessage("fake receiptHandle", eQueues.expediteIn)
        .catch((returnVal) => {
          expect(returnVal).to.exist;
          done();
        });
    });

    it('should reject if failed to fetch queue url', (done) => {
      self.restoreGeneralStubs(); // this functionality does not needed here

      // fail in sqs.createQueue - queue url will not be available
      self.createQueueStubReturn = null;
      self.createQueueStubReturnErr = {Err: "err"};

      self.createQueueStub = sinon.stub(QueueApi.sqs, "createQueue").callsFake((params: aws.SQS.Types.CreateQueueRequest, callback: (err: Error, data: aws.SQS.CreateQueueResult) => void) => {
        return callback(self.createQueueStubReturnErr, self.createQueueStubReturn);
      });

      self.createDeadLettersQueueStub = sinon.stub(QueueApi, "createDeadLettersQueue").callsFake(() => {
        return Promise.resolve("deadLettersQueueArn");
      });

      QueueApi.deleteMessage("bla", eQueues.longPoll)
        .catch((err) => {
          expect(err).to.exist;
          expect(self.createQueueStub.calledOnce).to.equal(true);
          self.createQueueStub.restore();
          self.createDeadLettersQueueStub.restore();
          done();
        });
    });
  });

  describe('.receive', () => {
    beforeEach((done) => {
      self.initGeneralStubs();
      QueueApi.resetCachedConfig();

      self.receiveMessageStub = sinon.stub(QueueApi.sqs, "receiveMessage").callsFake((params: aws.SQS.Types.ReceiveMessageRequest, callback: (err: Error, data: aws.SQS.ReceiveMessageResult) => void) => {
        return callback(self.receiveMessageStubReturnErr, self.receiveMessageStubReturn);
      });
      done();
    });

    afterEach((done) => {
      self.restoreGeneralStubs();
      self.receiveMessageStub.restore();
      done();
    });

    it('should resolve successfully if had no messages in queue', (done) => {
      self.receiveMessageStubReturn = { };

      self.receiveMessageStubReturnErr = null;

      QueueApi.receive(eQueues.longPoll)
        .then((returnVal) => {
          expect(returnVal).to.exist;
          expect(returnVal).to.be.instanceof(Array);
          expect(returnVal.length).to.equal(0);
          done();
        })
        .catch(done);
    });

    it('should resolve successfully if had one message in queue', (done) => {
      self.receiveMessageStubReturn = { Messages: [{
        MessageId: "messageId123",
        ReceiptHandle: "receiptHandle123",
        Body: { param: "val" }
      }]};

      self.receiveMessageStubReturnErr = null;

      QueueApi.receive(eQueues.longPoll)
        .then((returnVal) => {
          expect(returnVal).to.exist;
          expect(returnVal).to.be.instanceof(Array);
          expect(returnVal.length).to.equal(self.receiveMessageStubReturn.Messages.length);
          done();
        })
        .catch(done);
    });

    it('should resolve successfully if had more than one message in queue after all messages was handled', (done) => {
      self.receiveMessageStubReturn = { Messages: [{
        MessageId: "messageId123",
        ReceiptHandle: "receiptHandle123",
        Body: { param: "val" }
      },
      {
        MessageId: "messageId456",
        ReceiptHandle: "receiptHandle456",
        Body: { param: "val" }
      }]};

      self.receiveMessageStubReturnErr = null;

      QueueApi.receive(eQueues.longPoll)
        .then((returnVal) => {
          expect(returnVal).to.exist;
          expect(returnVal).to.be.instanceof(Array);
          expect(returnVal.length).to.equal(self.receiveMessageStubReturn.Messages.length);
          expect(returnVal[0].messageId).to.equal(self.receiveMessageStubReturn.Messages[0].MessageId);
          expect(returnVal[1].messageId).to.equal(self.receiveMessageStubReturn.Messages[1].MessageId);
          done();
        })
        .catch(done);
    });

    it('should reject with error if sqs receive message was failed', (done) => {
      self.receiveMessageStubReturn = null;
      self.receiveMessageStubReturnErr = {Err: "err"};

      QueueApi.receive(eQueues.longPoll)
        .catch((returnVal) => {
          expect(returnVal).to.exist;
          done();
        });
    });

    it('should reject if failed to fetch queue url', (done) => {
      self.restoreGeneralStubs(); // this functionality does not needed here

      // fail in sqs.createQueue - queue url will not be available
      self.createQueueStubReturn = null;
      self.createQueueStubReturnErr = {Err: "err"};

      self.createQueueStub = sinon.stub(QueueApi.sqs, "createQueue").callsFake((params: aws.SQS.Types.CreateQueueRequest, callback: (err: Error, data: aws.SQS.CreateQueueResult) => void) => {
        return callback(self.createQueueStubReturnErr, self.createQueueStubReturn);
      });

      self.createDeadLettersQueueStub = sinon.stub(QueueApi, "createDeadLettersQueue").callsFake(() => {
        return Promise.resolve("deadLettersQueueArn");
      });

      QueueApi.receive(eQueues.longPoll)
        .catch((err) => {
          expect(err).to.exist;
          self.createQueueStub.restore();
          self.createDeadLettersQueueStub.restore();
          done();
        });
    });
  });

  describe('.startLongPoll', () => {
    beforeEach((done) => {
      self.initGeneralStubs();
      QueueApi.resetCachedConfig();

      self.receiveMessageStub = sinon.stub(QueueApi.sqs, "receiveMessage").callsFake((params: aws.SQS.Types.ReceiveMessageRequest, callback: (err: Error, data: aws.SQS.ReceiveMessageResult) => void) => {
        return callback(self.receiveMessageStubReturnErr, self.receiveMessageStubReturn);
      });

      self.deleteMessageStub = sinon.stub(QueueApi.sqs, "deleteMessage").callsFake((params: aws.SQS.Types.DeleteMessageRequest, callback: (err: Error, data: any) => void) => {
        self.receiveMessageStubReturn.Messages = self.receiveMessageStubReturn.Messages.filter((message) => {
          return message.ReceiptHandle != params.ReceiptHandle;
        }); // clear deleted messages from the "dummy queue"
        return callback(self.deleteMessageStubReturnErr, self.deleteMessageStubReturn);
      });


      self.messageHandler = MessageHandlerCallback => {
        return self.messageHandlerReturn;
      };

      self.messageHandlerSpy = sinon.spy(self, 'messageHandler');

      done();
    });

    afterEach((done) => {
      self.restoreGeneralStubs();
      self.receiveMessageStub.restore();
      self.deleteMessageStub.restore();
      self.messageHandlerSpy.restore();
      done();
    });

    it('should resolve successfully if had no messages in queue', (done) => {
      self.messageHandlerReturn =  Promise.resolve();

      self.receiveMessageStubReturn = { };

      self.receiveMessageStubReturnErr = null;

      self.deleteMessageStubReturn = {};
      self.deleteMessageStubReturnErr = null;

      QueueApi.startLongPoll(self.messageHandler, false)
        .then(() => {
          expect(self.messageHandlerSpy.notCalled).to.equal(true);
          expect(self.receiveMessageStub.calledOnce).to.equal(true);
          expect(self.deleteMessageStub.notCalled).to.equal(true);
          done();
        })
        .catch(done);
    });

    it('should resolve successfully if had one message in queue', (done) => {
      self.messageHandlerReturn =  Promise.resolve();

      self.receiveMessageStubReturn = {
        Messages: [{ // will be deleted during test run
          MessageId: "messageId123",
          ReceiptHandle: "receiptHandle123",
          Body: { param: "val" }
        }]
      };

      self.receiveMessageStubReturnErr = null;

      self.deleteMessageStubReturn = {};
      self.deleteMessageStubReturnErr = null;

      QueueApi.startLongPoll(self.messageHandler, false)
        .then(() => {
          expect(self.messageHandlerSpy.calledOnce).to.equal(true);
          expect(self.receiveMessageStub.calledOnce).to.equal(true);
          expect(self.deleteMessageStub.calledOnce).to.equal(true);
          expect(self.messageHandlerSpy.getCall(0).args[0].messageId).to.equal("messageId123");
          done();
        })
        .catch(done);
    });

    it('should resolve successfully if had more than one message in queue after all messages was handled', (done) => {
      self.messageHandlerReturn =  Promise.resolve();

      self.receiveMessageStubReturn = { Messages: [{
        MessageId: "messageId123",
        ReceiptHandle: "receiptHandle123",
        Body: { param: "val" }
      },
      {
        MessageId: "messageId456",
        ReceiptHandle: "receiptHandle456",
        Body: { param: "val" }
      }]};

      self.deleteMessageStubReturn = {};
      self.deleteMessageStubReturnErr = null;

      QueueApi.startLongPoll(self.messageHandler, false)
        .then(() => {
          expect(self.messageHandlerSpy.calledTwice).to.equal(true);
          expect(self.receiveMessageStub.calledOnce).to.equal(true);
          expect(self.deleteMessageStub.calledTwice).to.equal(true);
          expect(self.messageHandlerSpy.getCall(0).args[0].messageId).to.equal("messageId123");
          done();
        })
        .catch(done);
    });

    it('should reject with error if sqs receive message was failed', (done) => {
      self.receiveMessageStubReturn = null;
      self.receiveMessageStubReturnErr = {Err: "err"};

      QueueApi.startLongPoll(self.messageHandler, false)
        .catch((returnVal) => {
          expect(returnVal).to.exist;
          expect(self.messageHandlerSpy.notCalled).to.equal(true);
          expect(self.deleteMessageStub.notCalled).to.equal(true);
          expect(self.receiveMessageStub.calledOnce).to.equal(true);
          done();
        });
    });

    it('should reject with error if sqs receive message was failed "maxFailedPollRetries" times', (done) => {
      QueueApi.getConfig().longPoll.maxFailedPollRetries = 3;

      self.receiveMessageStubReturn = null;
      self.receiveMessageStubReturnErr = {Err: "err"};

      self.delayStub = sinon.stub(QueueApi, "delay").callsFake(() => {
        return Promise.resolve();
      });

      QueueApi.startLongPoll(self.messageHandler, true, true)
        .catch((returnVal) => {
          expect(returnVal).to.exist;
          expect(self.messageHandlerSpy.notCalled).to.equal(true);
          expect(self.deleteMessageStub.notCalled).to.equal(true);
          expect(self.delayStub.calledOnce).to.equal(true);
          expect(self.receiveMessageStub.callCount).to.equal(QueueApi.getConfig().longPoll.maxFailedPollRetries);

          self.delayStub.restore();
          done();
        })
        .catch(done);
    });

    it('should reject if messageHandler was rejected and do not delete the message (remain "in-flight")', (done) => {
      self.messageHandlerReturn =  Promise.reject({Err: "err"});

      self.receiveMessageStubReturn = {
        Messages: [{ // will be deleted during test run
          MessageId: "messageId123",
          ReceiptHandle: "receiptHandle123",
          Body: { param: "val" }
        }]
      };

      self.receiveMessageStubReturnErr = null;

      self.deleteMessageStubReturn = {};
      self.deleteMessageStubReturnErr = null;

      QueueApi.startLongPoll(self.messageHandler, false)
        .catch(() => {
          expect(self.receiveMessageStub.calledOnce).to.equal(true);
          expect(self.messageHandlerSpy.calledOnce).to.equal(true);
          expect(self.deleteMessageStub.notCalled).to.equal(true);
          done();
        })
        .catch(done);
    });

    it('should reject if failed to fetch queue url', (done) => {
      self.restoreGeneralStubs(); // this functionality does not needed here

      // fail in sqs.createQueue - queue url will not be available
      self.createQueueStubReturn = null;
      self.createQueueStubReturnErr = {Err: "err"};

      self.createQueueStub = sinon.stub(QueueApi.sqs, "createQueue").callsFake((params: aws.SQS.Types.DeleteMessageRequest, callback: (err: Error, data: aws.SQS.CreateQueueResult) => void) => {
        return callback(self.createQueueStubReturnErr, self.createQueueStubReturn);
      });

      self.createDeadLettersQueueStub = sinon.stub(QueueApi, "createDeadLettersQueue").callsFake(() => {
        return Promise.resolve("deadLettersQueueArn");
      });

      QueueApi.startLongPoll(self.messageHandler, false)
        .catch((err) => {
          expect(err).to.exist;
          expect(err).to.equal(self.createQueueStubReturnErr);
          expect(self.createQueueStub.calledOnce).to.equal(true);
          expect(self.messageHandlerSpy.notCalled).to.equal(true);
          self.createQueueStub.restore();
          self.createDeadLettersQueueStub.restore();
          done();
        });
    });
  });

  describe('exceptions handling', () => {
    beforeEach((done) => {
      self.initGeneralStubs();

      self.sendMessageExceptionStub = sinon.stub(QueueApi.sqs, "sendMessage").callsFake((params: aws.SQS.Types.SendMessageRequest, callback: (err: Error, data: aws.SQS.SendMessageResult) => void) => {
        throw "Exception!";
      });

      self.deleteMessageExceptionStub = sinon.stub(QueueApi.sqs, "deleteMessage").callsFake((params: aws.SQS.Types.DeleteMessageRequest, callback: (err: Error, data: any) => void) => {
        throw "Exception!";
      });

      self.receiveMessageExceptionStub = sinon.stub(QueueApi.sqs, "receiveMessage").callsFake((params: aws.SQS.Types.ReceiveMessageRequest, callback: (err: Error, data: aws.SQS.ReceiveMessageResult) => void) => {
        throw "Exception!";
      });

      done();
    });

    afterEach((done) => {
      self.restoreGeneralStubs();
      self.sendMessageExceptionStub.restore();
      self.deleteMessageExceptionStub.restore();
      self.receiveMessageExceptionStub.restore();
      done();
    });


    it('.send should reject with error if exception raised', (done) => {
      QueueApi.send("my fake message", eQueues.expediteIn)
        .catch((returnVal) => {
          expect(returnVal).to.equal("Exception!");
          done();
        });
    });

    it('.delete should reject with error if exception raised', (done) => {
      QueueApi.deleteMessage("my fake message", eQueues.expediteIn)
        .catch((returnVal) => {
          expect(returnVal).to.exist;
          done();
        });
    });

    it('.receive should reject with error if exception raised', (done) => {
      QueueApi.receive(eQueues.expediteIn)
        .catch((returnVal) => {
          expect(returnVal).to.exist;
          done();
        });
    });

  });

  describe('.getQueueUrl', () => {
    beforeEach(() => {
      QueueApi.resetCachedConfig();
    });

    it('should return url from config by enum parameter', (done) => {
      self.initGeneralStubs();
      QueueApi.getQueueUrl(eQueues.expediteIn)
        .then((queueUrl) => {
          expect(queueUrl).to.exist;
          expect(queueUrl).to.include(Config.queues.expediteIn.name);
          self.restoreGeneralStubs();
          done();
        })
        .catch(done);
    });

    it('should return long polling queue url using aws sdk', (done) => {
      self.initGeneralStubs();
      QueueApi.getQueueUrl(eQueues.longPoll)
        .then((queueUrl) => {
          expect(queueUrl).to.exist;
          expect(queueUrl).to.equal("fakeLongPollingUrl");
          self.restoreGeneralStubs();
          done();
        })
        .catch(done);
    });

    it('should reject if queue config was not found', (done) => {
      self.initGeneralStubs();
      let config = QueueApi.getConfig();
      let restoreVal = config.expediteIn; // overriding only for this test

      config.expediteIn = null;

      QueueApi.getQueueUrl(eQueues.expediteIn)
        .catch((err) => {
          expect(err).to.exist;
          self.restoreGeneralStubs();
          // restoring config original value
          config.expediteIn = restoreVal;
          done();
        });
    });

    it('should reject if queue config is missing name value', (done) => {
      self.initGeneralStubs();
      let config = QueueApi.getConfig();
      let restoreVal = config.expediteIn.region; // overriding only for this test

      config.expediteIn.region = null;

      QueueApi.getQueueUrl(eQueues.expediteIn)
        .catch((err) => {
          expect(err).to.exist;
          self.restoreGeneralStubs();
          // restoring config original value
          config.expediteIn.region = restoreVal;
          done();
        });
    });

    it('should reject if queue config is missing region value', (done) => {
      self.initGeneralStubs();
      let config = QueueApi.getConfig();
      let restoreVal = config.expediteIn.name; // overriding only for this test

      config.expediteIn.name = null;

      QueueApi.getQueueUrl(eQueues.expediteIn)
        .catch((err) => {
          expect(err).to.exist;
          self.restoreGeneralStubs();
          // restoring config original value
          config.expediteIn.name = restoreVal;
          done();
        });
    });

    it('should reject if .getLongPollQueueUrl was rejected', (done) => {
      self.longPollQueueUrlStubResultsErr = {Err: "err"};

      self.longPollQueueUrlStub = sinon.stub(QueueApi, "getLongPollQueueUrl").callsFake(() => {
        return Promise.reject<any>(self.longPollQueueUrlStubResultsErr);
      });

      QueueApi.getQueueUrl(eQueues.longPoll)
        .catch((err) => {
          expect(err).to.exist;
          expect(err).to.equal(self.longPollQueueUrlStubResultsErr);
          self.longPollQueueUrlStub.restore();
          done();
        });
    })
  });

  describe('.getQueueObject', () => {
    beforeEach(() => {
      QueueApi.resetCachedConfig();
    });

    it('should return queue object by config values', (done) => {
      let queueObject = QueueApi.getQueueObject(eQueues.matchMergeIn);

      expect(queueObject).to.exist;
      expect(queueObject.name).to.equal(QueueApi.getConfig().matchMergeIn.name);
      expect(queueObject.region).to.equal(QueueApi.getConfig().matchMergeIn.region);

      done();
    });

    it('should return undefined when parameter is null', (done) => {
      let queueObject = QueueApi.getQueueObject(null);

      expect(queueObject).to.not.exist;

      done();
    });

    it('should return undefined when no config for required queue', (done) => {
      let config = QueueApi.getConfig();
      let tempQueueConfig = config.matchMergeIn;

      delete config.matchMergeIn;

      let queueObject = QueueApi.getQueueObject(eQueues.matchMergeIn);

      expect(queueObject).to.not.exist;

      config.matchMergeIn = tempQueueConfig;

      done();
    });
  });

  describe('.getLongPollQueueUrl', () => {
    beforeEach((done) => {
      QueueApi.resetCachedConfig();

      self.createQueueStub = sinon.stub(QueueApi.sqs, "createQueue").callsFake((params: aws.SQS.Types.DeleteMessageRequest, callback: (err: Error, data: aws.SQS.CreateQueueResult) => void) => {
        return callback(self.createQueueStubReturnErr, self.createQueueStubReturn);
      });

      self.createDeadLettersQueueStub = sinon.stub(QueueApi, "createDeadLettersQueue").callsFake(() => {
        return Promise.resolve("deadLettersQueueArn");
      });

      done();
    });

    afterEach((done) => {
      self.createQueueStub.restore();
      self.createDeadLettersQueueStub.restore();
      done();
    });

    it('should return url using sqs.createQueue', (done) => {
      self.createQueueStubReturn = {QueueUrl: "fake url"};
      self.createQueueStubReturnErr = null;

      QueueApi.getLongPollQueueUrl()
        .then((queueUrl) => {
          expect(queueUrl).to.exist;
          expect(queueUrl).to.equal(self.createQueueStubReturn.QueueUrl);
          expect(self.createQueueStub.calledOnce).to.equal(true);
          done();
        })
        .catch(done);
    });

    it('should call sqs.createQueue once if longPollQueue url already fetched', (done) => {
      self.createQueueStubReturn = {QueueUrl: "fake url"};
      self.createQueueStubReturnErr = null;

      QueueApi.getLongPollQueueUrl()
        .then((queueUrl) => {
          return QueueApi.getLongPollQueueUrl()
        })
        .then((queueUrl) => {
          expect(queueUrl).to.exist;
          expect(queueUrl).to.equal(self.createQueueStubReturn.QueueUrl);
          expect(self.createQueueStub.calledOnce).to.equal(true);
          done();
        })
        .catch(done);
    });

    it('should return error if returned from sqs.createQueue', (done) => {
      self.createQueueStubReturn = null;
      self.createQueueStubReturnErr = {Err: "err"};

      QueueApi.getLongPollQueueUrl()
        .catch((err) => {
          expect(err).to.exist;
          expect(err).to.equal(self.createQueueStubReturnErr);
          expect(self.createQueueStub.calledOnce).to.equal(true);
          done();
        });
    });
  });
});
