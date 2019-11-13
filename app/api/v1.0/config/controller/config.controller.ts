import ConfigService from "../service/config.service";
import * as express from 'express';
export class ConfigController {

  static configPostEntityPriorities(req:express.Request, res:express.Response): Promise<express.Response> {
    return new Promise((resolve, reject) => {
      
      if (req.body == null || !(req.body instanceof Array)) {
        resolve(res.status(400).send("no string array provided"));
        return
      }
      
      return ConfigService.setEntityPriorities(req.body)
        .then(() => resolve(res.status(200).send(null)))
        .catch(error => resolve(res.status(400).send(error)));
    })
  }
}
