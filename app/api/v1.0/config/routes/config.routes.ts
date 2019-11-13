import * as express from 'express';
import {ConfigController} from '../controller/config.controller';
import ServiceActions from '../../serviceActions';
import PermissionMiddleware from '../../../../routes/permission/permission.middleware.interface'

export class ConfigRoutes {
    static init(router: express.Router, baseUrl: string, permissions: PermissionMiddleware) {
      router
        .route(baseUrl + '/config/entityPriorities')
        .post(permissions(ServiceActions.data.config.entityPriorities.write), ConfigController.configPostEntityPriorities);
    }
}
