import * as express from 'express';
import HealthService from "../service/health.service";

export class HealthController {

  static getLiveness(req:express.Request, res:express.Response): Promise<express.Response> {
    return new Promise((resolve, reject) => {

      HealthService.livenessCheck()
      .then(report => {
        resolve(res.status(report.status).json(report))
      })
      .catch(error => {
        resolve(res.status(400).send(error))
      });
    })
  };

  static getReadiness(req:express.Request, res:express.Response): Promise<express.Response> {
    return new Promise((resolve, reject) => {

      HealthService.readinessCheck()
      .then(report => {
        resolve(res.status(report.status).json(report))
      })
      .catch(error => {
        resolve(res.status(400).send(error))
      });
    })
  };

}
