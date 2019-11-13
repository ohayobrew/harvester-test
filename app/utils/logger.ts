import * as winston from 'winston';

const fs = require('fs');
const logsdir = './logs';


//TODO: move to another config structure
import * as path from 'path';
let configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
let Config = require(configFilePath) || {log: {}};

//define the time format
const timeFormatFn = function() {
  let now = new Date();
  return now.toUTCString();
};

if (!fs.existsSync(logsdir)){
  fs.mkdirSync(logsdir);
}

let logger = new winston.Logger({
  transports: [
    new winston.transports.File({
      level: Config.log.level,
      filename: logsdir + '/server.log',
      handleExceptions: true,
      json: true,
      maxsize: 5242880, //5MB
      maxFiles: 10,
      colorize: false,
      timestamp: timeFormatFn
    }),
    new winston.transports.Console({
      level: Config.log.level,
      handleExceptions: true,
      colorize: false,
      json: Config.log.json,
      stringify: Config.log.stringify,
      timestamp: timeFormatFn
    })
  ],
  exitOnError: false
});

export class Logger {
  static silly = (message: string, meta?: any): void => {
    logger.log("silly", message, meta? meta : "");
  };

  static debug = (message: string, meta?: any): void => {
    logger.log("debug", message, meta? meta : "");
  };

  static verbose = (message: string, meta: any): void => {
    logger.log("verbose", message, meta? meta : "");
  };

  static info = (message: string, meta?: any): void => {
    logger.log("info", message, meta? meta : "");
  };

  static warn = (message: string, meta?: any): void => {
    logger.log("warn", message, meta? meta : "");
  };

  static error = (message: string, meta?: any): void => {
    logger.log("error", message, meta? meta : "");
  };

  static stream = {
    write: (message: string): void => {
      logger.info(message);
    }};

  //static logAndResolve = (message: string, err?: any, meta?: any, resolve?: Function, reject?: Function, obj?: any): void => {
  //  if (err != null) {
  //    Logger.error(message, err);
  //    reject(err);
  //  }
  //  else {
  //    Logger.debug(message, meta);
  //    resolve(obj);
  //  }
  //}
}
