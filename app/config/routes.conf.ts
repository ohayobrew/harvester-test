"use strict";

import * as express from 'express';
import * as morgan from 'morgan';
import * as bodyParser from 'body-parser';
import * as helmet from 'helmet';
import {Logger} from '../utils/logger';
let contentLength = require('express-content-length-validator');

export class RoutesConfig {
    static init(application: express.Application):void {
      let jsonParser = bodyParser.json({limit:1024*1024*1, type:'application/json'}); // 1mb
      let urlencodedParser = bodyParser.urlencoded({ extended:true,limit:1024*1024*1,type:'application/x-www-form-urlencoding' }); // 1mb
        application.use(jsonParser);
        application.use(urlencodedParser);
        application.use(morgan('tiny', { "stream": Logger.stream }));
        application.use(helmet());
		    application.use((req, res, next) => {
          res.header("Access-Control-Allow-Origin", "*");
          res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
          res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, VATBOX-USER-ID, VATBOX-USER-NAME");
          next();
        });
    }
}
