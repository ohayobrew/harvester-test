import {Logger} from '../../utils/logger';
import {Helpers} from '../../helpers/helpers';
import {IUserModel} from "./user.model.interface";
import {IUserModelMongoose} from "./user.model.interface";
import * as mongoose from 'mongoose';
import * as _ from 'lodash';
import * as util from 'util';

let _schema = new mongoose.Schema({
  email: String,
  vatboxUserId: String,
  tags: [String]
});


let _model: mongoose.Model<IUserModelMongoose> = mongoose.model<IUserModelMongoose>("User", _schema);

class UserModel implements IUserModel {
  private _document: IUserModel;
  private _thisModel: IUserModel;
  private _id: string;

  constructor(userModel: IUserModel) {
    this._thisModel = userModel;

    this.saveId(userModel);
  }

  static get mongoose(): mongoose.Model<IUserModelMongoose> {
    return _model;
  };

  get mongooseDocument(): Promise<IUserModelMongoose> {
    let self = this;

    return new Promise((resolve:Function, reject:Function) => {
      if (self._document == null) {
        _model
          .findOne({_id: self._thisModel.id})
          .exec()
          .then((image) => {
            self._document = image;
            resolve(image);
          })
          .catch((err) => {
            Logger.warn("Error while querying for instance model. Model object:"
              + JSON.stringify(self._thisModel) + ". Error: ", err);
            reject(err);
          });
      }
      else {
        resolve(self._document);
      }
    });
  };

  get id(): string {
    return this._id;
  };

  get email(): string {
    return this._thisModel.email;
  };

  get vatboxUserId(): string {
    return this._thisModel.vatboxUserId;
  };

  get tags(): string[] {
    return this._thisModel.tags;
  };

  static findById(userId: string): Promise<UserModel> {
    return new Promise((resolve, reject) => {
      let logMessage = "Find user by id: " + userId;

      if (Helpers.isObjectId(userId)) {
        // It's a valid ObjectId, proceed with 'findById' call.
        _model.findById(<string>userId)
          .exec((err, user) => {

            if (err != null) {
              Logger.error(logMessage + ". Error:", err);
              reject(err);
            }
            else if (user != null){
              Logger.debug(logMessage + ". User:", JSON.stringify(user));
              resolve(new UserModel(user));
            }
            else{
              Logger.warn(logMessage + " was not found");
              resolve(null);
            }
          })
      }
      else {
        Logger.info(logMessage + " is not a legal ObjectId");
        resolve(null);
      }
    });
  };

  static findByIds(userIds: string[]): Promise<UserModel[]> {
    return new Promise((resolve:Function, reject:Function) => {
      let logMessage = `Find users by ids: ${userIds}`;

      Logger.info(`Finding users by ids: ${userIds}`);

      if (userIds != null && userIds.length > 0) {
        _model.find({_id: { $in: userIds }})
          .exec((err, users) => {

            if (err != null) {
              Logger.error(logMessage + ". Error:", err);
              reject(err);
            }
            else if (users != null){
              Logger.debug(logMessage + ". User:", JSON.stringify(users));
              resolve(users.map((user) => new UserModel(user)));
            }
            else{
              Logger.warn(logMessage + ", not results found");
              resolve(null);
            }
          })
      }
      else {
        Logger.warn(logMessage + " is not a legal ids array");
        resolve(null);
      }
    });
  };

  static createUser(user: IUserModel): Promise<UserModel> {
    return new Promise((resolve:Function, reject:Function):void => {
      if (!_.isObject(user)) {
        console.log('User is not a valid object')
        return reject(new TypeError('User is not a valid object.'));
      }

      //create and save a new user model
      new _model(user).save((err, newUser) => {
        if (err != null) {
          console.log('Could not create user')

          Logger.error("Could not create user " + JSON.stringify(user), err);
          reject(err);
        }

        Logger.debug("User " + JSON.stringify(user) + ", id: " + newUser.id + " created successfully");
        console.log('user created successfully')
        resolve(new UserModel(newUser));
      });
    });
  }

  static getByVatboxUserId(vatboxUserId: string): Promise<UserModel> {
    return new Promise((resolve:Function, reject:Function):void => {
      _model.findOne({vatboxUserId: vatboxUserId})
        .exec((err, user) => {
          if (err != null) {
            Logger.error("Error on find user by vatboxUserId \'" + vatboxUserId + "\'", err);
            reject(err);
          } else if (user != null) {
            Logger.debug("Found user by vatboxUserId: " + vatboxUserId + ", id: ", user.id);
            resolve(new UserModel(user));
          } else {  //no use found, resolved with undefined
            resolve();
          }
      });
    });
  }

  private saveId(userModel: IUserModel) {
    if ((<IUserModelMongoose>userModel)._id != null)
      this._id = (<IUserModelMongoose>userModel)._id.toString();
  }
}

export default UserModel;
