import * as request from 'superagent';
import {Logger} from '../utils/logger';
import ImageModel from "../models/image/image.model";
import {ICropArea} from "../models/image/image.model.interface";

//TODO: move to another config structure
import * as path from 'path';
import {resolve} from "url";
let configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
let Config = require(configFilePath) || {};

let LEMMINGS_USERS = `${Config.lemmingsApi.host}${Config.lemmingsApi.apiPath}${Config.lemmingsApi.userIdsApi}`;

export interface LemmingsUsersInfoRes {
  notFound: string[];
  found: [{
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    active: boolean;
  }];
}

export class LemmingsService {
  public static getUsers(requestingUserId: string, userIds: string[]): Promise<LemmingsUsersInfoRes> {
    return new Promise((resolve:Function, reject:Function) => {
      request.post(LEMMINGS_USERS)
        .send(JSON.stringify(userIds))
        .set('VATBOX-USER-ID', requestingUserId)
        .set("CallingServer", Config.serviceName)
        .set('Content-Type', 'application/json')
        .timeout({response: Config.lemmingsApi.requestTimeoutMs})
        .end((err, res) => {
          if (err) {
            let message: string;

            if (err.status === 404) {
              message = "Lemmings service error:" + JSON.stringify(res);
            } else if (err.timeout) {
              message = "Lemmings service timeout - " + err.toString();
            } else {
              message = "Failed to fetch users info from Lemmings service. "  + JSON.stringify(res);
            }

            Logger.error(message);

            return reject(new Error(message));
          }

          if (res.status === 200) {
            Logger.debug("Fetched users info from Lemmings: " + JSON.stringify(res));

            resolve(res.body);
          }	else {
            let message = "Unknown success status returned from Lemmings API. Response: " + JSON.stringify(res);
            Logger.error(message);

            reject(new Error(message));
          }
        });
    });
  }
}
