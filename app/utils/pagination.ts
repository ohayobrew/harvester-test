//TODO: move to another config structure
import * as path from 'path';
let configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
let Config = require(configFilePath) || {};

export class Pagination {
  static isInScope = (limit: number, offset: number): boolean => {
    if (limit <= 0 || offset < 0 || limit > Config.maxPaginationLimitSize)
      return false;

    return true;
  };
}

