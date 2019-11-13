"use strict";

import * as express from 'express';
import {HealthController} from '../controller/health.controller';

export class HealthRoutes {
    static init(router: express.Router, baseUrl: string) {
      router
        .route(baseUrl + '/health/liveness')
        .get(HealthController.getLiveness);

      router
        .route(baseUrl + '/health/readiness')
        .get(HealthController.getReadiness);
    }
}
