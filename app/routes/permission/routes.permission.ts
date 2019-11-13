import * as express from 'express';
import UserModel from '../../models/user/user.model';
import {Logger} from '../../utils/logger';
import {AuthorizationService} from "../../services/authorizationService";

export default class RoutesPermission {

  public static permission(activity: string): express.RequestHandler {
    return (req: express.Request, res: express.Response, next: Function) => {
      req.body.user = { activity };

      let ret = RoutesPermission.verifyUserHeader(req, res, next);
      return ret;
    };
  }

  static verifyUserHeader(req: express.Request, res: express.Response, next: Function) {
    if (req.method != 'OPTIONS' && (req.header("VATBOX-USER-ID") == null || req.header("VATBOX-USER-ID") === "")) {
      res.status(401).send("No VATBox User ID header supplied");
    }
    else {
      if (req.method === 'OPTIONS')
        return next();

      //check if the user exists on our db
      UserModel.getByVatboxUserId(req.header("VATBOX-USER-ID"))
        .then((user) => {
          if (user)
            return user;
          else {
            let vatboxUserId = req.header("VATBOX-USER-ID");
            let email = req.header("VATBOX-USER-NAME");
            //create the user
            return UserModel.createUser({vatboxUserId, email, tags: []})
              .then((user) => {
                Logger.info("User by vatboxUserId \'" + vatboxUserId + "\' was not found, creating a new one");
                return user;
              });
          }
        })
        .then((user) => {
          req.body.user.model = user;
          return RoutesPermission.authorizer(req, res, next);
        })
        .catch((err) => {
          Logger.error(`Error while authorizing user request for activity: '${req.body.user ? req.body.user.activity : "NA"}' for user: '${req.body.user ? req.body.user.vatboxUserId : "NA"}'`, err);

          return res.status(500).send(null);
        });
    }
  }
  
  static authorizer(req: express.Request, res: express.Response, next: Function) {
    if (req.body.user == null || req.body.user.model == null || req.body.user.activity == null)
      return res.sendStatus(403);

    AuthorizationService.isPermittedUser(req.body.user.model.vatboxUserId, req.body.user.activity, req.header("CallingServer"))
      .then((isPermitted) => {
        if (isPermitted)
          return next();
        else
          return res.sendStatus(403);
      })
      .catch((err) => {
        return res.sendStatus(500);
      })
  }
}

