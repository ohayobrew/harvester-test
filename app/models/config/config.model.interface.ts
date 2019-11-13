import * as mongoose from 'mongoose';

export interface IConfigModel {
  id?: string;
  updatedAt: Date;
  entityPriorities?: IEntityPriority[];
};

export interface IConfigModelMongoose extends IConfigModel, mongoose.Document {
  id?: string;
};

export interface IEntityPriority {
  entityId?: string;
  priority?: number;
  consider?: boolean;
}
