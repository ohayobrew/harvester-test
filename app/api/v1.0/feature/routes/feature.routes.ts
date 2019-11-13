"use strict";

import * as express from 'express';
import { FeatureController } from '../controller/feature.controller';
import ServiceActions from '../../serviceActions';
import PermissionMiddleware from '../../../../routes/permission/permission.middleware.interface'

export class FeatureRoutes {
    static init(router: express.Router, baseUrl: string, permission: PermissionMiddleware) {
      
      router
        .route(baseUrl + '/feature')
        .get(permission(ServiceActions.data.featureFlag.toggle), FeatureController.getList);

      router
        .route(baseUrl + '/feature/:id')
        .get(permission(ServiceActions.data.featureFlag.toggle), FeatureController.getFeature);
      
      router
      .route(baseUrl + '/feature/:id')
        .post(permission(ServiceActions.data.featureFlag.toggle), FeatureController.changeFeatureStatus);
    }
}
