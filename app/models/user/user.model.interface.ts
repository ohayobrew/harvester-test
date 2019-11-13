import * as mongoose from 'mongoose';

export interface IUserModel {
  id?: string;
  email?: string;
  vatboxUserId: string,
  tags: string[]
}

export interface IUserModelMongoose extends IUserModel, mongoose.Document {
  id?: string;
}
