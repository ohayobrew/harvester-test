
import * as mongoose from 'mongoose'
import { IFeatureFlagModelMongoose, IFeatureFlag } from './featureFlagModel.interface';
import _ = require('lodash');
import { Logger } from '../../utils/logger';

let _schema = new mongoose.Schema({
    name: String,
    isOn: {type: Boolean, default: false}
});

export const _featureFlagModel: mongoose.Model<IFeatureFlagModelMongoose> = mongoose.model<IFeatureFlagModelMongoose>("Feature_Flag", _schema);

export class FeatureFlagModel implements IFeatureFlag {

    private _model;

    constructor(model) {
        this._model = model
    }

    get id(): String {
        return this._model._id.toString();
    }

    get name(): String {
        return this._model.name;
    }

    get isOn(): Boolean {
        return this._model.isOn;
    }

    static list(): Promise<IFeatureFlag[]> {
        Logger.debug("Listing features");

        return _featureFlagModel.find()
        .then(features => {
            if (!features) {
                Logger.debug(`Could not list features`);
                return Promise.resolve(null)
            }

            return features.map(feature => new FeatureFlagModel(feature))
        })
        .catch(err => {
            Logger.error("Problem listing features: ", err.message);
            return Promise.reject(err.message);
        })
    }

    static create(featureFlagName: String): Promise<IFeatureFlag> {
        Logger.debug(`Creating new feature flag with name ${featureFlagName}`);

        if (_.isEmpty(featureFlagName)) {
            return Promise.reject(new TypeError('FeatureFlag is not a valid object.'));
        }

        let featureFlagModel = new _featureFlagModel({name: featureFlagName});
        return featureFlagModel.save()
            .then(feature => {
                if (!feature) {
                    Logger.debug(`Could not create feature flag with name: ${featureFlagName}`);
                    return Promise.resolve(null)
                }

                Logger.debug(`Feature flag ${featureFlagName} created`, feature._id);
                return new FeatureFlagModel(feature);
            })
            .catch(err => {
                Logger.error(`Problem to add new feature flag: `, err.message);
                return Promise.reject(err.message);
            })
    };

    static update(featureId: String, updateObj: Object): Promise<IFeatureFlag> {
        Logger.debug(`Updating feature flag id ${featureId}`);

        return _featureFlagModel
            .findOneAndUpdate({_id: featureId}, updateObj, { new: true })
            .exec()
            .then((updatedFeature) => {
                if (!updatedFeature) {
                    Logger.debug(`Could not update feature flag id: ${featureId}`);
                    return Promise.resolve(null)
                }

                Logger.debug(`Feature flag id ${featureId} updated successfully`);
                return new FeatureFlagModel(updatedFeature);
            })
            .catch(error => {
                Logger.error(`Problem updating feature flag: ${featureId}`, error.message);
                return Promise.reject(error.message);
            })
    }

    static findById(featureId: String): Promise<IFeatureFlag> {
        Logger.debug(`Finding feature flag by id: ${featureId}`);

        return _featureFlagModel.findById(featureId)
            .then(feature => {
                if (!feature) {
                    Logger.debug(`Could not find feature flag with id: ${featureId}`);
                    return Promise.resolve(null)
                }
                
                return new FeatureFlagModel(feature);
            })
            .catch(err => {
                Logger.error(`Problem finding feature flag with id ${featureId}: `, err.message);
                return Promise.reject(err.message);
            })
    }

    static findByName(featureName: String): Promise<IFeatureFlag> {
        Logger.debug(`Finding feature flag by name: ${featureName}`);

        return _featureFlagModel.findOne({name: featureName})
            .then(feature => {
                if (!feature) {
                    throw new Error(`Could not find feature flag with name ${featureName}`)
                }
                
                return new FeatureFlagModel(feature);
            })
            .catch(err => {
                Logger.error(`Problem finding feature flag with name ${featureName}: `, err.message);
                return Promise.reject(err.message);
            })
    }
}