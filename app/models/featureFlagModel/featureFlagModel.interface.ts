import * as mongoose from 'mongoose'

export interface IFeatureFlagModelMongoose extends IFeatureFlag, mongoose.Document {
    id: String,
    lockedUntil: Date
}

export interface IFeatureFlag {
    id: String,
    name: String,
    isOn?: Boolean 
}
