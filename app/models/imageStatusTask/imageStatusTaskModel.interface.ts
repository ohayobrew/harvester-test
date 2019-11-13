import * as mongoose from 'mongoose'

export interface IImageStatusTaskModelMongoose extends IImageStatusTask, mongoose.Document {
    id: String,
    lockedUntil: Date
}

export interface IImageStatusTask {
    id: String,
    lockedUntil: Date
}
