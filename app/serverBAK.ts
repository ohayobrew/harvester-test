'use strict';

console.info(`NODE_CONFIG_DIR is: ${process.env.NODE_CONFIG_DIR}`);

let PORT = process.env.PORT || 3333;

import * as express from 'express';
import * as os from 'os';
import {RoutesConfig} from './config/routes.conf';
import {Routes} from './routes/index';
import {QueueApi} from './utils/queueApi';
import {OutboundService} from "./services/outboundService";
import ImageService from './api/v1.0/image/service/imageService';
import * as http from "http"
import nock = require("nock");
import {AuthorizationService} from "./services/authorizationService";
import {DBService} from './services/dbService'
import { ImageStatusCheckerService } from './services/imageStatusCheckerService';

//ignore invalid SSL certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let app: express.Application = express();
let server: http.Server = app.listen(PORT);

RoutesConfig.init(app);
Routes.init(app, express.Router());
DBService.connect();

if (process.env.NODE_ENV != "test") { 
  QueueApi.startLongPoll(ImageService.createHandler, true);
  OutboundService.startTasksWatcher(true);
  ImageStatusCheckerService.run(true)
}
else {
  // mock Krang authorization service - return 200 for all requests
  nock(AuthorizationService.permissionApi)
    .persist()
    .get("", () => true)
    .reply(200, {can: true});
}

console.log(`up and running @: ${os.hostname()} on port: ${PORT}`);


export = app;
