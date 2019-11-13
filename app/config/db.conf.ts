"use strict";

import * as path from 'path';
import * as mongoose from 'mongoose';

let dbConfigFilePath = path.resolve(`${process.env.NODE_CONFIG_DIR}/db.json`);
let DbConstants = require(dbConfigFilePath) || {};

export class DBConfig {

  static getDefaultUrl(): string {
    return process.env.DB_HOSTS_AND_PORT
  }

  static getTestUrl(): string {
    return DbConstants.test.url
  }
}
