import {Logger} from '../../utils/logger';
import {IConfigModel, IEntityPriority} from "./config.model.interface";
import {IConfigModelMongoose} from "./config.model.interface";
import * as mongoose from 'mongoose';
import * as util from 'util';

let _schema = new mongoose.Schema({
  updatedAt: Date,
  entityPriorities: [{
    _id: false,
    entityId: String,
    priority: Number,
    consider: Boolean
  }]
});

let _model: mongoose.Model<IConfigModelMongoose> = mongoose.model("Config", _schema, "config");

class ConfigModel implements IConfigModel {
  private _document: IConfigModelMongoose;
  private _id: string;

  // should be instantiate using getConfig()
  constructor(configModel: IConfigModelMongoose) {
    this._document = configModel;
  }

  static get mongoose(): mongoose.Model<IConfigModelMongoose> {
    return _model;
  };

  get id(): string {
    if (this._document != null && this._document._id != null)
      return this._document._id.toString();
    else
      return;
  };

  get updatedAt(): Date {
    return this._document.updatedAt;
  };

  get entityPriorities(): IEntityPriority[] {
    return this._document.entityPriorities;
  };

  public static getConfig(): Promise<ConfigModel> {
    return new Promise((resolve:Function, reject:Function) => {
      let logMessage = "Get config document";

      Logger.debug(logMessage);

      ConfigModel.mongoose.findOne()
        .exec((err, config: IConfigModelMongoose) => {
          if (err != null) {
            Logger.error(logMessage + ". Error:", err);
            reject(err);
          }
          else if (config != null){
            Logger.debug(logMessage + ". Document:", JSON.stringify(config));
            resolve(new ConfigModel(config));
          }
          else{
            Logger.warn("Config document was not found, creating a new empty one");

            ConfigModel.mongoose.create({})
              .then((results: IConfigModelMongoose) => {
                Logger.info("Empty config document was created");
                resolve(new ConfigModel(results));
              })
              .catch((err) => {
                Logger.error(logMessage + ". Error:", err);
                reject(err)
              });
          }
        })
    });
  };

  private save(): Promise<IConfigModel> {
    return new Promise( (resolve:Function, reject:Function) => {
      let logMessage = "Save config document";

      Logger.debug(logMessage);

      this._document.updatedAt = new Date();

      this._document.save((err, config: IConfigModelMongoose) => {
        if (err == null) {
          Logger.debug(`Config was saved ${JSON.stringify(config)}`);
          this._document = config; // updating values for instance model;

          return resolve(config);
        }
        else {
          Logger.error("Could not save config", err);

          return reject(err);
        }
      })
    });
  };

  /* **********************
  * Entity Priority start
  ********************** */

  public getEntityPrioritiesSorted(ignoreConsider?: boolean): string[] {
    Logger.debug("Get entity ids sorted by priority");

    let ep: IEntityPriority[] = this.entityPriorities;

    if (ignoreConsider !== true) {
      Logger.debug("Including only entityId priorities with consider=true");
      ep = ep.filter((ep:IEntityPriority) => ep.consider);
    }

    let sortedEntityIds: string[] = ep
      .sort((ep1: IEntityPriority, ep2: IEntityPriority): number => {
        return ep2.priority - ep1.priority;
      })
      .map((ep: IEntityPriority) => ep.entityId);

    Logger.debug(`Returning sorted entity ids priorities:  "${sortedEntityIds.toString()}"`);

    return sortedEntityIds;
  };

  public setEntityPriorities(entityPriorities: IEntityPriority[]): Promise<IConfigModel> {
    Logger.debug(`Overriding entity ids priorities:  "${JSON.stringify(entityPriorities)}"`);

    this._document.entityPriorities = entityPriorities;

    return this.save();
  };

  public setEntityPriorityConsideration(entityId: string, consider: boolean): Promise<boolean> {
    let entityFound: boolean = false;

    Logger.info(`Setting entityId="${entityId}" priority consideration="${consider}"`);

    for (let i = 0; i < this._document.entityPriorities.length; i++) {
      if (this._document.entityPriorities[i].entityId === entityId) {
        entityFound = true;
        this._document.entityPriorities[i].consider = consider;
        break;
      }
    }

    if (entityFound){
      Logger.debug(`EntityId="${entityId}", setting priority consideration="${consider}"`);
      return this.save()
        .then(() => true);
    }
    else {
      Logger.error(`EntityId="${entityId}" was not found in priorities list`);
      return Promise.resolve(false);
    }
  };

  // TODO: test
  public isEntityIdExists(entityId: string): Promise<boolean> {

    let isExists = this._document.entityPriorities.some(priority => priority.entityId === entityId)

    return Promise.resolve(isExists);
  };

  public addNewEntity(entityId: string): Promise<IConfigModel> {
    Logger.info(`Adding entityId="${entityId}" to priorities list`);

    let entityPriority: IEntityPriority = {entityId: entityId, priority: 0, consider: true};

    return this.isEntityIdExists(entityId)
      .then((isExists) => {
        if (isExists){
          Logger.error(`Adding entityId="${entityId}" to priorities list failed - already exists`);

          return Promise.reject("EntityId already exists")
        }
        else {
          Logger.info(`Saving new entityId="${entityId}" to priorities list`);
          this._document.entityPriorities.push(entityPriority);

          return this.save();
        }
      });
  };

  public considerExistingEntity(entityId: string): Promise<boolean> {
    Logger.debug(`Setting consider=true for entityId="${entityId}", if exists in priorities list`);

    return this.isEntityIdExists(entityId)
      .then((isExist) => {
        if (isExist){
          return this.setEntityPriorityConsideration(entityId, true);
        }
        else {
          return Promise.resolve(false);
        }
      })
  }

  /* **********************
   * Entity Priority end
   ********************** */
}

export default ConfigModel;
