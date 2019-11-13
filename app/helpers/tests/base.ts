const {expect} = require('chai');

//TODO: move to another config structure
import * as path from 'path';
import {AuthorizationService} from "../../services/authorizationService";
import nock = require("nock");
import {Logger} from "../../utils/logger";
import {DBService} from '../../services/dbService'
let configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
let Config = require(configFilePath) || {};


export default class BaseTest {
  private static _instance: BaseTest = new BaseTest();

  private _timeAfterImageLockBegin: Date;
  private _timeBeforeImageLockBegin: Date;

  constructor() {
    if(BaseTest._instance){
      throw new Error("Error: Instantiation failed: Use BaseTest.getInstance() instead of new.");
    }
    BaseTest._instance = this;

    this._timeAfterImageLockBegin = new Date();
    this._timeBeforeImageLockBegin = new Date();
    this._timeAfterImageLockBegin.setMinutes(this._timeAfterImageLockBegin.getMinutes() - Config.imageLockForUserMinutes + 1);
    this._timeBeforeImageLockBegin.setMinutes(this._timeBeforeImageLockBegin.getMinutes() - (Config.imageLockForUserMinutes + 1));

    DBService.connect();
  }

  public static getInstance(): BaseTest {
    return BaseTest._instance;
  }

  public static get timeAfterImageLockBegin(): Date {
    console.log('BaseTest._instance._timeAfterImageLockBegin:', BaseTest._instance._timeAfterImageLockBegin)
    return BaseTest._instance._timeAfterImageLockBegin;
  }

  public static get timeBeforeImageLockBegin(): Date {
    console.log('BaseTest._instance._timeBeforeImageLockBegin:', BaseTest._instance._timeBeforeImageLockBegin)
    return BaseTest._instance._timeBeforeImageLockBegin;
  }

  public static authorizeAll(): void {
      Logger.debug(`Start authorization response mocking`);
      nock(AuthorizationService.permissionApi)
        .persist()
        .get("")
        .query(function(actualQueryObject){
          return true;
        })
        .reply(200, {can: true});
  }

  public static cleanNock(): void {
    Logger.debug(`Cleaning all nock pending mocks`);
    nock.cleanAll();
  }
}
