import * as express from 'express';
import FeatureService from '../service/feature.service'

export class FeatureController {

  static getList(req:express.Request, res:express.Response): Promise<express.Response> {
    return new Promise((resolve, reject) => {

      FeatureService.getList()
        .then(features => {
          if (features === null) {
            resolve(res.status(400).json({message: 'could not fetch features list'}))
          } else {
            resolve(res.status(200).json(features))
          }
        })
        .catch(error => {
          resolve(res.status(400).send(error))
        });
    })
  };
  
  static getFeature(req:express.Request, res:express.Response): Promise<express.Response> {
    return new Promise((resolve, reject) => {

      return FeatureService.getFeatureById(req.params.id)
        .then(results => {
          if (results === null) {
            resolve(res.status(400).json({messgae: 'could not find feature'}))
          } else {
            resolve(res.status(200).json(results))
          }
        })
        .catch(error => {
          resolve(res.status(400).send(error))
        });
    })
  };

  static changeFeatureStatus(req:express.Request, res:express.Response): Promise<express.Response> {
    return new Promise((resolve, reject) => {

      FeatureService.updateFeatureStatus(req.params.id, req.body.isOn)
        .then(results => {
          if (results === null) {
            resolve(res.status(400).json({messgae: 'could not update feature status'}))
          } else {
            resolve(res.status(200).json(results))
          }
        })
        .catch(error => {
          resolve(res.status(400).send(error))
        });
    })
  };

}
