import ConfigModel from '../../../../models/config/config.model';
import {Logger} from "../../../../utils/logger";
import {Deserializer} from '../../../../utils/deserializer';
import {IEntityPriority, IConfigModel} from "../../../../models/config/config.model.interface";

export default class ConfigService {
  
  static setEntityPriorities(orderedEntityIds: string[]): Promise<IConfigModel> {
    let entityPriorities: IEntityPriority[] = Deserializer.entityPriorities(orderedEntityIds);

    if (entityPriorities == null) {
      Logger.warn(`Failed while request of setting entityId priorities. Parameter can't be parsed.`);

      return Promise.reject("No entity ids provided");
    }

    return ConfigModel.getConfig()
      .then((config) => config.setEntityPriorities(entityPriorities))
  }
}

