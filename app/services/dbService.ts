"use strict";

import * as path from 'path';
import * as mongoose from 'mongoose';
import {DBConfig} from '../config/db.conf'



export class DBService {
  private static isConnected = false
  private static url;

  static connect(): Promise<void> {
    let options;

    if (DBService.isConnected) return
    DBService.isConnected = true

    if (process.env.NODE_ENV === "test") {
      DBService.url = DBConfig.getTestUrl()
    } else {
      DBService.url = DBConfig.getDefaultUrl()
      options = {autoReconnect: true}
    }

    DBService.listen()

    console.info(`Connecting to DB at URL: ${DBService.url} ...`);
    return mongoose.connect(DBService.url, options)
  }

  private static listen() {
    mongoose.connection.on('error', (err) => {
      console.error("An error occurred connecting to DB at URL: " + DBService.url, err);
      DBService.isConnected = false

      if (process.env.NODE_ENV != "test") {
        mongoose.disconnect();
      }
    });

    mongoose.connection.on('connected', () => {  
      console.info("Connected to db: " + mongoose.connection.db.databaseName);
    });

    mongoose.connection.on('disconnected', () => {
      console.error("Disconnected from db: " + DBService.url);
      DBService.isConnected = false
      if (process.env.NODE_ENV != "test") {
        DBService.connect();
      }
    });
  }

  static disconnect(): Promise<void> {
    return mongoose.disconnect()
  }

  static clearDB(): Promise<void> {
    return Promise.all(
      Object.keys(mongoose.connection.collections)
          .map( key => DBService.removeCollection(mongoose.connection.collections[key]))
    ).then(() => {})
  }

  private static removeCollection = (coll): Promise<void> => {
    return new Promise( (resolve, reject) => {
      coll.remove({}, () => {
        resolve()
      });
    })
  }

  
};
