import * as request from 'superagent';
import {Logger} from '../utils/logger';
import ImageModel from "../models/image/image.model";
import {ICropArea} from "../models/image/image.model.interface";
const NodeCache = require( "node-cache" );


//TODO: move to another config structure
import * as path from 'path';
import {resolve} from "url";

var configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
const Config = require(configFilePath) || {};
const authorizationCache = Config.authorizationCache || {}
const cacheConfig = {
  stdTTL: authorizationCache.stdTTLSec || 100,
  checkperiod: authorizationCache.checkperiodSec || 120
}
const cacheRequests = new NodeCache(cacheConfig);

let KRANG_PATH = `${Config.krangApi.host}${Config.krangApi.apiPath}`;

export class AuthorizationService {
  static get permissionApi(): string {
    return `${KRANG_PATH}${Config.krangApi.permissionApi}`;
  }

  public static isPermittedUser(vatboxUserId: string, activity: string, callingService?: string): Promise<boolean> {
    return new Promise((resolve:Function, reject:Function) => {
      if (vatboxUserId == null || activity == null || activity === "") {
        let msg = `No vatboxUserId ("${vatboxUserId}") or activity ("${activity}") supplied for authorization`;

        Logger.warn(msg);

        return reject(msg);
      }

      let requestBody = {
        callingUser: vatboxUserId,
        service: Config.serviceName,
        action: activity
      };

      let requestHeaders: any = {};

      if (callingService != null && callingService !== ""){
        requestHeaders["CallingServer"] = callingService;
        requestBody["callingServer"] = callingService;
      }

      requestHeaders["Vatbox-User-Id"] = vatboxUserId;
      // requestHeaders["Vatbox-Service-Name"] = Config.serviceName;

      let permissionQuery = `${AuthorizationService.permissionApi}?actionName=${Config.serviceName}::${activity}`;
      Logger.debug(`Calling krang at ${permissionQuery} vatboxUserId=${vatboxUserId}, activity=${activity}, callingService=${callingService}, requestBody=${JSON.stringify(requestBody)}, requestHeaders=${JSON.stringify(requestHeaders)}`);

      if (cacheRequests.get(`${vatboxUserId}@${permissionQuery}`)) {
        resolve(true)
        return
      }

      request
        .get(`${permissionQuery}` )
        .timeout(Config.krangApi.requestTimeoutMs)
        .set(requestHeaders)
        .send()
        .end((err, res) => {
          if (err !== null) {
            let message: string;

            if (err.status === 404)
              message = `Authorization service not found ${err.status} - ${err.toString()}`;
            else if (err.status === 400)
              message = `Authorization bad request ${err.status} - ${err.toString()}. Detailed response: ${res? JSON.stringify(res) : 'none'}`;
            // in case of "Forbidden", we do not reject, simply notify the user
            else if (err.status === 403){
              message = `Authorization service response ${err.status}: user "${vatboxUserId}" is NOT permitted for activity "${activity}". Detailed response: ${res? JSON.stringify(res) : 'none'}`;
              Logger.warn(message);

              return resolve(false);
            }
            else if (err.status === 500) {
              message = `Authorization service internal error ${err.status} - ${err.toString()}. Detailed response: ${res? JSON.stringify(res) : 'none'}`;
            }
            else if (err.status === 504) {
              message = `Authorization service Gateway timeout (error ${err.status}) - ${err.toString()}. Detailed response: ${res? JSON.stringify(res) : 'none'}`;
            }
            else if (err.timeout != null) {
              message = "Authorization service canPerform timed out - " + err.toString();
            }
            else {
              message = `Authorization service request failure: ${err.toString()}. Detailed response: ${res? JSON.stringify(res) : 'none'}`;
            }

            Logger.error(message);
            resolve(true);    // for loacal testing only, remove this before deployment
            //return reject(new Error(message));  //uncomment before deployment
          }

          if (res.status === 200) {
            Logger.debug(`Authorization service response 200 for - user: "${vatboxUserId}" is permitted for activity: "${activity}"`);
            cacheRequests.set(`${vatboxUserId}@${permissionQuery}`, true)

            return resolve(true);
          }	else {
            let message = `Unhandled status returned from authorization service. Detailed response: ${res? JSON.stringify(res) : 'none'}`;
            Logger.error(message);

            return reject(new Error(message));
          }
        });
    });
  }
}
