"use strict";

import * as express from 'express';
import {ImageController} from '../controller/image.controller';
import ServiceActions from '../../serviceActions';
import PermissionMiddleware from '../../../../routes/permission/permission.middleware.interface'

export class ImageRoutes {
    static init(router: express.Router, baseUrl: string, permission: PermissionMiddleware) {
      router
        .route(baseUrl + '/image')
        .get(permission(ServiceActions.data.image.next), ImageController.imageGetNext);

      router
        .route(baseUrl + '/image/entity/:entityId')
        .get(permission(ServiceActions.data.image.nextByEntity), ImageController.imageGetNext);

      router
        .route(baseUrl + '/image/:imageId')
        .get(permission(ServiceActions.data.image.byId), ImageController.imageGetById);

      router
        .route(baseUrl + '/image/:imageId/area')
        .post(permission(ServiceActions.data.image.area.create), ImageController.imagePostCreateCropArea);

      router
        .route(baseUrl + '/image/:imageId/area/:areaId')
        .delete(permission(ServiceActions.data.image.area.delete), ImageController.imageDeleteCropArea);

      router
        .route(baseUrl + '/image/:imageId/action/:verb')
        .post(permission(ServiceActions.data.image.complete), ImageController.imagePostComplete);

      router
        .route(baseUrl + '/image/:imageId/single')
        .post(permission(ServiceActions.data.image.complete), ImageController.imagePostSingleImage);

      router
        .route(baseUrl + '/images')
        .get(permission(ServiceActions.data.images.query), ImageController.imageGetQuery);

      router
        .route(baseUrl + '/images')
        .post(ImageController.imagePostCreate);

      router
        .route(baseUrl + '/images/report/entities/statuses')
        .get(permission(ServiceActions.data.images.report.entities.statuses), ImageController.reportGetEntitiesStatuses);

      router
        .route(baseUrl + '/images/report/entities/statuses/inProgress')
        .get(permission(ServiceActions.data.images.report.entities.inProgress), ImageController.reportGetEntitiesStatusInProgress);

      router
        .route(baseUrl + '/images/report/entities/performance')
        .get(permission(ServiceActions.data.images.report.entities.performance), ImageController.reportGetEntitiesPerformance);

      router
        .route(baseUrl + '/images/report/users')
        .get(permission(ServiceActions.data.images.report.users.performance), ImageController.reportGetUsers);

      router
        .route(baseUrl + '/images/imaginary/:imaginaryId')
        .get(permission(ServiceActions.data.images.byImaginaryId), ImageController.imageGetStatusByImaginaryId);

      router
        .route(baseUrl + '/images/failure/count')
        .get(permission(ServiceActions.data.images.failedQuery), ImageController.getImagesStatusErrorCount);

      router
        .route(baseUrl + '/images/failure/reset')
        .post(permission(ServiceActions.data.images.failedQuery), ImageController.retryFailureImages);
    }
}
