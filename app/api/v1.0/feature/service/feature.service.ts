import { Logger } from './../../../../utils/logger';
import { FeatureFlagModel } from '../../../../models/featureFlagModel/featureFlagModel.model';
import { IFeatureFlag } from '../../../../models/featureFlagModel/featureFlagModel.interface';

export default class FeatureService {

  static create(featureName): Promise<IFeatureFlag> {
    return  FeatureFlagModel.create(featureName)
  }

  static getList(): Promise<IFeatureFlag[]> {
    return FeatureFlagModel.list()
  }

  static getFeatureById(featureId): Promise<IFeatureFlag> {
    return FeatureFlagModel.findById(featureId);
  }

  static getFeatureByName(featureName): Promise<IFeatureFlag> {
    return FeatureFlagModel.findByName(featureName);
  }

  static updateFeatureStatus(featureId, isOn): Promise<any> {
    return FeatureFlagModel.update(featureId, {isOn})
  }

  static isFeatureOn(featureName): Promise<Boolean> {
    return FeatureFlagModel.findByName(featureName)
      .then((feature) => feature.isOn)
  }
}

