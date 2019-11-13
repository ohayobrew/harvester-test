import * as aws from 'aws-sdk';
import {Logger} from './logger';
import metrics from "./metrics";

//TODO: move to another config structure
import * as path from 'path';
let configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
let Config = require(configFilePath) || {};

// will work with the region defined in the long polling config
let _sqs: aws.SQS = new aws.SQS({region: Config.queues.longPoll.region});

export enum eQueues { longPoll, expediteIn, matchMergeIn }

export interface IQueueConfig {
  deadLettersSuffix: string,
  longPoll: {
    name: string,
    region: string,
    url: string,
    waitTimeSeconds: number,
    messageRetentionPeriodDays: number,
    maxNumberOfMessages: number,
    maxFailedPollRetries: number,
    maxReceiveCount: number,
    visibilityTimeoutSec: number
  },
  expediteIn: {
    name: string,
    region: string,
    url: string
  },
  matchMergeIn: {
    name: string,
    region: string,
    url: string
  }
}

export interface IIncomingMessage {
  messageId: string;
  receiptHandle: string;
  body: any;
}

export interface MessageHandlerCallback { (message: IIncomingMessage): Promise<void> };

export class QueueApi {
  private static _config: IQueueConfig = Config.queues;
  private static _longPollFailureCounter: number = 0;

  static get sqs(): aws.SQS {
      return _sqs;
  };

  public static send (message: string, queue: eQueues): Promise<string> {
    return new Promise((resolve:Function, reject:Function) => {
      QueueApi.getQueueUrl(queue)
        .then((queueUrl) => {
          try {
            Logger.debug(`Sending message="${JSON.stringify(message)}" to queueUrl="${queueUrl}"`);

            _sqs.sendMessage({
                QueueUrl: queueUrl,
                MessageBody: message },
              (err: Error, data: aws.SQS.SendMessageResult) => {
                if (err != null){
                  Logger.error(`Error while sending message ${JSON.stringify(message)} to queueUrl=${queueUrl}`, err);
                  reject(err);
                }
                else {
                  Logger.info(`Message ${JSON.stringify(message)} was sent to queueUrl="${queueUrl}", SQS MessageId="${data.MessageId}"`);
                  resolve(data.MessageId);
                }
              });
          }
          catch (e){
            Logger.error(`Exception while sending message ${JSON.stringify(message)} to queueUrl=${queueUrl}`, e);
            reject(e);
          }
        })
        .catch((err) => {
          Logger.error(`Error while fetching queueUrl for sending message=${JSON.stringify(message)} on queue="${eQueues[queue]}"`, err);
          reject(err);
        });
    });
  };

  public static receive (queue: eQueues): Promise<IIncomingMessage[]> {
    return new Promise((resolve:Function, reject:Function) => {
      QueueApi.getQueueUrl(queue)
        .then((queueUrl) => {
          try {
            Logger.debug(`Receiving from SQS queue="${queueUrl}"`);

            _sqs.receiveMessage({
                QueueUrl: queueUrl,
                MaxNumberOfMessages: QueueApi._config.longPoll.maxNumberOfMessages
            },
              (err: Error, data: aws.SQS.ReceiveMessageResult) => {
                if (err != null){
                  Logger.error(`Error while receiving messages from queueUrl=${queueUrl}`, err);
                  reject(err);
                }
                else {
                  let messages = [];

                  if (data.Messages != null) {
                    Logger.info(`Received ${data.Messages.length} messages from SQS queue="${queueUrl}"`);

                    messages = data.Messages.map((message) => {
                      return {
                        messageId: message.MessageId,
                        receiptHandle: message.ReceiptHandle,
                        body: message.Body
                      };
                    });
                  }
                  else {
                    Logger.debug(`Long polling received no messages from SQS queue="${queueUrl}"`);
                  }

                  resolve(messages);
                }
              });
          }
          catch (e){
            Logger.error(`Exception while receiving messages from queueUrl=${queueUrl}`, e);
            reject(e);
          }
        })
        .catch((err) => {
          Logger.error(`Error while receiving messages from queue="${eQueues[queue]}"`, err);
          reject(err);
        });
    });
  };

  public static deleteMessage (receiptHandle: string, queue: eQueues): Promise<any> {
    return new Promise((resolve:Function, reject:Function) => {
      return QueueApi.getQueueUrl(queue)
        .then((queueUrl) => {
          try {
            Logger.debug(`Deleting message.receiptHandle="${receiptHandle}" from SQS queue="${queueUrl}"`);

            _sqs.deleteMessage({
                QueueUrl: queueUrl,
                ReceiptHandle: receiptHandle
              },
              (err: Error, data: any) => {
                if (err != null){
                  Logger.error(`Error while deleting message with receiptHandle="${receiptHandle}" on queueUrl=${queueUrl}`, err);
                  reject(err);
                }
                else {
                  Logger.info(`Message with ReceiptHandle="${receiptHandle}" on queueUrl="${queueUrl}", successfully deleted`);
                  resolve(data);
                }
              });
          }
          catch (e){
            Logger.error(`Exception while deleting message with receiptHandle="${receiptHandle}" on queueUrl=${queueUrl}`, e);
            reject(e);
          }
        })
        .catch((err) => {
          Logger.error(`Error while fetching queueUrl for deleting message with receiptHandle="${receiptHandle} on queue="${eQueues[queue]}"`, err);
          reject(err);
        });
    });
  };

  public static getQueueObject(queue: eQueues) {
    if (queue == null)
      return;

    let name = eQueues[queue];

    if (QueueApi._config[name] == null){
      let msg = `No configuration found for queue="${name}"!`;
      Logger.warn(msg);

      return;
    }

    return {
      name: QueueApi._config[name].name,
      region: QueueApi._config[name].region
    }
  }

  public static getQueueUrl(queue: eQueues): Promise<string> {
    if (queue == eQueues.longPoll)
      return QueueApi.getLongPollQueueUrl();
    else
      return QueueApi.getQueueUrlByName(eQueues[queue]);
  }

  public static getQueueUrlByName(name: string): Promise<string> {
    return new Promise((resolve:Function, reject:Function) => {
      if (QueueApi._config[name] == null){
        let msg = `No configuration found for queue="${name}"!`;
        Logger.error(msg);
        return reject(msg);
      }

      if (QueueApi._config[name].url == null){
        let queueName = QueueApi._config[name].name;
        let queueRegion = QueueApi._config[name].region;

        if (queueName == null || queueRegion == null || queueName == "" || queueRegion == ""){
          let msg = `No configuration found for queue="${name}" (missing name and/or region)!`;
          Logger.error(msg);
          return reject(msg);
        }

        try {
          Logger.info(`Trying get queue url for queue="${name}" (queue name="${queueName}", region="${queueRegion}")`);
          // creating new sqs client instance, in order to be flexible about different region than the one of the long poll queue
          QueueApi.generateSqsObject(queueRegion).getQueueUrl({ QueueName: queueName },
            (err: Error, data: any) => {
              if (err != null){
                Logger.error(`Error while getting sqs queue url for queue="${name}" (queue name="${queueName}", region="${queueRegion}")`, err);
                reject(err);
              }
              else {
                Logger.info(`Url for queue="${name}" (queue name="${queueName}", region="${queueRegion}") is "${data.QueueUrl}"`);

                QueueApi._config[name].url = data.QueueUrl;

                resolve(data.QueueUrl);
              }
            });
        }
        catch (e){
          Logger.error(`Exception while getting queue url of queue "${name}"`, e);
          reject(e);
        }
      }
      else {
        Logger.debug(`Loading queue "${name}" url from cache`);
        resolve(QueueApi._config[name].url)
      }
    });
  }

  // on first call will init the queue, and then save the url
  public static getLongPollQueueUrl(): Promise<string> {
    if (QueueApi._config[eQueues[eQueues.longPoll]].url == null){
      Logger.debug(`Initialize longPollQueueUrl`);
      return QueueApi.initSqsLongPollQueue()
        .then((queueUrl) => QueueApi._config[eQueues[eQueues.longPoll]].url = queueUrl);
    }
    else
      return Promise.resolve<string>(QueueApi._config[eQueues[eQueues.longPoll]].url);
  }

  // for testing usage
  public static resetCachedConfig(): void {
    Logger.debug(`Clearing cached config`);
    QueueApi._config.longPoll.url = null;
    QueueApi._config.expediteIn.url = null;
    QueueApi._config.matchMergeIn.url = null;
    QueueApi._longPollFailureCounter = 0;
  }

  // for testing usage
  public static getConfig(): IQueueConfig {
    Logger.debug(`returning cached config`);
    return QueueApi._config;
  }

  // forever - for testing usage pass false
  // oneCycle - if true, will quit after the defined amount of retries
  public static startLongPoll(messageHandler: MessageHandlerCallback, forever: boolean, oneCycle?: boolean): Promise<void> {
    Logger.info(`Starting long polling...`);
    return QueueApi.doLongPoll(messageHandler, forever, oneCycle);
  };

  private static generateSqsObject(region: string): aws.SQS {
    // in order to have one reference of service object in testing
    if (process.env.NODE_ENV == "test")
      return _sqs;

    // if existing service object does not match the desired region, will return a new one
    if (aws.config.region == region) ///aws.config.region is the region of '_sqs'
      return _sqs;
    else
      return new aws.SQS({region});
  };

  private static doLongPoll(messageHandler: MessageHandlerCallback, forever: boolean, oneCycle?: boolean): Promise<void> {
    let startTime: number = +new Date();

    return QueueApi.receive(eQueues.longPoll)
      .then((messages: IIncomingMessage[]) => {
        if (messages != null && messages.length > 0){
          metrics.histogram("inbound_messages", messages.length);
          Logger.info(`Received  ${messages.length} messages from longPoll queue`);
        }
        else
          Logger.debug(`Received NO messages from longPoll queue`);

        return QueueApi.handleReceivedMessages(messages, eQueues.longPoll, messageHandler);
      })
      .then((results) => {
        let endTime: number = +new Date();

        if (results.length > 0) {
          Logger.info(`Done handling ${results.length} messages from longPoll queue (${endTime - startTime} ms)`);
        }

        if (forever){
          Logger.debug(`Polling queue...`);
          QueueApi.doLongPoll(messageHandler, forever, oneCycle);
        }
      })
      .catch((err) => {
        Logger.error(`Error while long polling from longPoll queue`, err);

        QueueApi._longPollFailureCounter++;

        if (forever && (Config.queues.longPoll.maxFailedPollRetries == null || (QueueApi._longPollFailureCounter < Config.queues.longPoll.maxFailedPollRetries))){
          Logger.info(`running long poll again`);
          return QueueApi.doLongPoll(messageHandler, forever, oneCycle);
        } else if (forever && (QueueApi._longPollFailureCounter === Config.queues.longPoll.maxFailedPollRetries)) {
          
          QueueApi._longPollFailureCounter = 0;

          Logger.error(`Long poll will sleep for ${Config.queues.longPoll.delayBeforeNewRetryMs}ms before a new retry`, err);

          return QueueApi
            .delay(Config.queues.longPoll.delayBeforeNewRetryMs)
            .then(() => {
              if (oneCycle != true) {
                Logger.info(`not a oneCycle mode, running long poll`);
                return QueueApi.doLongPoll(messageHandler, forever);
              }
              else {
                Logger.info(`oneCycle is true, quitting...`);
                return Promise.reject(err);
              }
            })
        }
        else {
            Logger.error(`Quiting long poll operation `, err);
            return Promise.reject(err);
          }
      });
  };

  public static delay(ms: number): Promise<void>  {
    return new Promise((resolve:Function, reject:Function):void => {
      setTimeout(() => {resolve()}, ms);
    });
  }

  private static handleReceivedMessages(messages: IIncomingMessage[], queue: eQueues, messageHandler: MessageHandlerCallback): Promise<void[]> {
    let actions = messages.map((message) => {
      try {
        return messageHandler(message)
          .then(() => {return QueueApi.deleteMessage(message.receiptHandle, queue)}) // delete message just after handling it, even if reject was raised
          .catch((err) => {
            Logger.error(`Failed handling completely with incoming messageId=${message.messageId}, receiptHandle=${message.receiptHandle}, body=${JSON.stringify(message.body)}`, err);

            // skip message deletion - will wait as "in-flight" or move to dead letters queue
            return Promise.reject(`Failed handling incoming message - skip deleting messageId=${message.messageId}, receiptHandle=${message.receiptHandle}, body=${JSON.stringify(message.body)}`);
          });
      }
      catch(e) {
        let msg = `Exception while handling messageId=${message.messageId}, receiptHandle=${message.receiptHandle}`;
        Logger.error(msg, e);
        return Promise.reject(e);
      }
    });

    if (messages != null && messages.length > 0)
      Logger.info(`Start handling ${messages.length} messages from longPoll queue`);

    return Promise.all(actions);
  }

  // create queue on first time and return its url. If already exist, sqs will ignore and return url
  private static initSqsLongPollQueue(): Promise<string> {
    return new Promise((resolve:Function, reject:Function) => {
      try {
        // region is set in _sqs initialize above
        QueueApi.createDeadLettersQueue()
          .then((deadLettersQueueArn) => {
            let redrivePolicy = JSON.stringify({
              deadLetterTargetArn: deadLettersQueueArn,
              maxReceiveCount: (QueueApi._config.longPoll.maxReceiveCount).toString()
            });

            Logger.info(`Creating/retrieving longPollQueue by config params=${JSON.stringify(QueueApi._config.longPoll)}`);

            return _sqs.createQueue({ // sqs service expect strings, not numbers
              QueueName: QueueApi._config.longPoll.name,
              Attributes: {
                MessageRetentionPeriod: (QueueApi._config.longPoll.messageRetentionPeriodDays * 24 * 60 * 60).toString(),
                ReceiveMessageWaitTimeSeconds: QueueApi._config.longPoll.waitTimeSeconds.toString(),
                VisibilityTimeout: QueueApi._config.longPoll.visibilityTimeoutSec.toString(),
                RedrivePolicy: redrivePolicy
              }
            }, (err: Error, data: aws.SQS.CreateQueueResult) => {
              if (err != null || data == null || data.QueueUrl == null){
                Logger.error(`QueueApi: initSqsLongPollQueue - Error while creatingQueue name="${QueueApi._config.longPoll.name}" region=${QueueApi._config.longPoll.region}`, err);
                reject(err);
              }
              else {
                Logger.info(`SQS createQueue returned url=${data.QueueUrl}`);
                resolve(data.QueueUrl);
              }
          })
        })
        .catch(error => {
          Logger.error('QueueApi: initSqsLongPollQueue had error while creating dead letters queue', error)
          reject(error);
        })
      }
      catch (e){
        Logger.error(`Exception while creatingQueue name="${QueueApi._config.longPoll.name}" region=${QueueApi._config.longPoll.region}`, e);
        reject(e);
      }
    });
  };

  // create queue on first time and return its url. If already exist, sqs will ignore and return url
  public static createDeadLettersQueue(): Promise<string> {
    let _createDeadLettersQueue: Promise<string> = new Promise((resolve:Function, reject:Function) => {
      try {
        Logger.info(`Creating/retrieving dead letters queue for ${JSON.stringify(QueueApi._config.longPoll)} queue`);
        // region is set in _sqs initialize above
        _sqs.createQueue({ // sqs service expect strings, not numbers
          QueueName: QueueApi._config.longPoll.name + QueueApi._config.deadLettersSuffix,
          Attributes: {
            MessageRetentionPeriod: (QueueApi._config.longPoll.messageRetentionPeriodDays * 24 * 60 * 60).toString()
          }
        }, (err: Error, data: aws.SQS.CreateQueueResult) => {
          if (err != null || data == null || data.QueueUrl == null){
            Logger.error(`Error while creatingQueue name="${QueueApi._config.longPoll.name + QueueApi._config.deadLettersSuffix}" region=${QueueApi._config.longPoll.region}`, err);
            reject(err);
          }
          else {
            Logger.info(`SQS createQueue returned url=${data.QueueUrl}`);
            resolve(data.QueueUrl);
          }
        })
      }
      catch (e){
        Logger.error(`Exception while creatingQueue name="${QueueApi._config.longPoll.name}" region=${QueueApi._config.longPoll.region}`, e);
        reject(e);
      }
    });

    return _createDeadLettersQueue
      .then((deadLettersQueueUrl): Promise<string> => {
        return new Promise((resolve:Function, reject:Function) => {
          _sqs.getQueueAttributes({
            AttributeNames: ["QueueArn"],
            QueueUrl: deadLettersQueueUrl
          }, (err: Error, data: aws.SQS.GetQueueAttributesResult) => {
            if (err != null || data == null || !data.Attributes || data.Attributes["QueueArn"] == null){
              Logger.error(`Error while getQueueAttributes name="${QueueApi._config.longPoll.name + QueueApi._config.deadLettersSuffix}" region=${QueueApi._config.longPoll.region} (data="${JSON.stringify(data)}")`, err);
              reject(err);
            }
            else {
              Logger.info(`SQS getQueueAttributes returned QueueArn=${data.Attributes["QueueArn"]}`);
              resolve(data.Attributes["QueueArn"]);
            }
          })
        });
      })
  }
}
