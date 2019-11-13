import * as express from 'express';
import {HealthRoutes} from "./health/routes/health.routes";
import {ImageRoutes} from './image/routes/image.routes';
import {ConfigRoutes} from "./config/routes/config.routes";
import {FeatureRoutes} from './feature/routes/feature.routes'
import PermissionMiddleware from '../../routes/permission/permission.middleware.interface'
export module api_v1_0 {
  
  export class Routes {
    static init(router:express.Router, permission: PermissionMiddleware) {
      let baseUrl = "/api/exposed/v1.0";
      let internalBaseUrl = "/api/internal/v1.0";

      HealthRoutes.init(router, internalBaseUrl);
      ImageRoutes.init(router, baseUrl, permission);
      ConfigRoutes.init(router, baseUrl, permission);
      FeatureRoutes.init(router, baseUrl, permission);
    }
  }
}

