import * as express from 'express';
import {api_v1_0} from '../api/v1.0/api.routes';
import RoutesPermission from './permission/routes.permission'

export class Routes {
   static init(app: express.Application, router: express.Router) {
     api_v1_0.Routes.init(router, RoutesPermission.permission);
     app.use('/', router);
   }
}
