import * as path from 'path';

let configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
let config = require(configFilePath) || {};

export class ConfigService {

  static getConfig(key = null) {
    if (key) return config[key];

    return config || {}
  }
}
