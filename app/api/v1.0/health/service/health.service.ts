import * as mongoose from 'mongoose';
import {Logger} from "../../../../utils/logger";

export default class HealthService {
  static livenessCheck(): Promise<any> {
    return HealthService.testDbConnection();
  }

  static readinessCheck(): Promise<any> {
    return HealthService.testDbConnection();
  }

  private static testDbConnection(): Promise<any> {
    let report = {
      isOk: true,
      message: "",
      status: 200
    };

    if (mongoose.connection.readyState !== 1){
      Logger.warn(
        "DB connection issue while health checking: readyState=" +
        mongoose.connection.readyState +
        ". {0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting}");

      report.isOk = false;
      report.status = 500;
      report.message = "DB is not connected. readyState=" + mongoose.connection.readyState;
    }

    return Promise.resolve(report);
  }
}

