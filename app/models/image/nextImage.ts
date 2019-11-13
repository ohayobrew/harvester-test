// import * as Bromise from 'bluebird';
import ImageModel, {IImageFetcher} from "./image.model";
import {Logger} from "../../utils/logger";
import {eImageStatus, IImageModel} from "./image.model.interface";
import {Helpers} from "../../helpers/helpers";
import * as _ from 'lodash';
//TODO: move to another config structure
import * as path from 'path';
import ConfigModel from "../config/config.model";

let configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
let Config = require(configFilePath) || {};

export class NextImage implements IImageFetcher {
  private readonly _query: any;
  private readonly _queryLockedImageOfUser: any;
  private _updateQuery: any;
  private _options: any;

  constructor(private userId: string, private tags?: string[]) {
    // TODO: querying by '$exists: false' is not efficient

    this._query = {
      $or: [
        {
          status: eImageStatus.inProgress,
          updatedAt: {$exists: false}
        },//Default Filter that looks for non existing updated props
        {
          status: eImageStatus.inProgress,
          updatedAt: {$lt: new Date(Helpers.subtractMinutesFromNow(Config.imageLockForUserMinutes))}
        },//Existing filter for previously updated documents Note: This was existing did not know what to do with this one
        {
          status: eImageStatus.potentiallyBadFile,
          updatedAt: {$lt: new Date(Helpers.subtractMinutesFromNow(Config.imageLockForUserMinutes))}
        }// New filter to serve potentiallyBadFiles with the timeblock
      ]

    };


    // query for image that is within lock timeframe and by current user
    this._queryLockedImageOfUser = {
      status: eImageStatus[eImageStatus.inProgress],
      activeUser: this.userId,
      updatedAt: {$gt: Helpers.subtractMinutesFromNow(Config.imageLockForUserMinutes)}
    };

    this._updateQuery = {$set: {updatedAt: Date.now(), status: eImageStatus.inProgress, activeUser: this.userId, tsSubmitted: Date.now()}};
    // Following has been disabled, because the order of handling doesn't really matter. However, using sort entails a huge overhead on the query.
    // When there are a lot of documents to retrieve the time it takes to execute the query gradually grows and causes the whole process to slow down.
    // return the oldest one first
    //this._options = {sort: {createdAt: "asc"}, new: true};
    this._options = {new: true}; // Not clear why this is necessary. According to the documentation, there is no such option

    //fetch images having at least one of the user's tags
    if (_.isArray(this.tags) && this.tags.length > 0) {
      this.augmentOrQuery("tags", {$elemMatch: {$in: this.tags}});
    }
    else // No tags?
    {
      this.cleanupOrQuery("tags");
    }

// will not find images where tag is undefined
// else {	//fetch images having no tags
//   this._query.tags = {$exists: true, $size: 0};
// }
  }

  /**
   * Adds an item to each of the or parts of the _query because mongo does a bad job optimizing when it handles
   * multiple parts of an or query and has to join them and a good job if it gets the additional item in each part
   *
   * @param name
   * @param part
   */
  private augmentOrQuery(name: string, part: any)
  {
    Logger.info(`Initial query: ${JSON.stringify(this._query)}`);
    const list = this._query.$or;
    if (!list) // Safety
    {
      return;
    }
    const len = list.length;

    // Loop over the array contained in the $or clause
    for (let i=0;i<len;i++)
    {
      list[i][name] = part; // Add the new part to each item in the array
    }
    Logger.info(`Final query: ${JSON.stringify(this._query)}`);
  }

  /**
   * Deletes an item from each of the or parts of the _query to cleanup after augmentOrQuery
   *
   * @param name
   */
  private cleanupOrQuery(name: string)
  {
    Logger.info(`Initial query: ${JSON.stringify(this._query)}`);
    const list = this._query.$or;
    if (!list) // Safety
    {
      return;
    }
    const len = list.length;

    // Loop over the array contained in the $or clause
    for (let i=0;i<len;i++)
    {
      delete list[i][name]; // Cleanup the property from each item in the array
    }
    Logger.info(`Final query: ${JSON.stringify(this._query)}`);
  }

  public fetch(entityId?: string, pickOneForCrop?:boolean): Promise<ImageModel> { /// adding neew parameter (pickOneForCrop) here to
    Logger.info(`Fetching next image for user.id=${this.userId}`);                /// get image with requestedSkipCrop OFF

    return new Promise((resolve, reject) => {
      if (!Helpers.isObjectId(this.userId)) {
        let logMessage = "UserId: " + this.userId + " is not a legal ObjectId";
        Logger.info(logMessage);

        reject(logMessage);
      } else {
        if (entityId) // Need to add a specific entityId?
        {
          this.augmentOrQuery("entityId", entityId);
        }
        else // No specific entityId
        {
          this.cleanupOrQuery("entityId");
        }

        Logger.info(`Querying for locked image ${JSON.stringify(this._queryLockedImageOfUser)}`);

        if(pickOneForCrop) {
          this._query.requestedSkipCrop = false;   /// setting new query attribute to get specific image for cropping
        }

        return ImageModel.mongoose.findOneAndUpdate(this._queryLockedImageOfUser, this._updateQuery, this._options)
          .exec()
          .then(image => {
            if (image) return this.logAndResolve(resolve, reject, null, image);
            else if (entityId) { // case of no error, no image and asking for specific entityId
              Logger.info(`No locked image for user.id="${this.userId}"`);
              Logger.info(`Fetching next image for user.id="${this.userId}" by specific entityId=${entityId}`);

              return ImageModel.mongoose
                .findOneAndUpdate(this._query, this._updateQuery, this._options)
                .exec()
                .then((image) => this.logAndResolve(resolve, reject, null, image))
                .catch((err) => this.logAndResolve(resolve, reject, err));
            } else { // case of no error, no image (most of times)
              Logger.info(`No locked image for user.id="${this.userId}"`);
              Logger.info(`Fetching next image for user.id="${this.userId}" by entity priorities `);
              return this.loopUntilFindByPriority()
                .then((image) => {
                  //console.log(`**** img: ${image ? image.id : 'no image'} ****`);
                  return this.logAndResolve(resolve, reject, null, image)
                })
                .catch((err) => this.logAndResolve(resolve, reject, err));
            }
          })
          .catch(err => {
            return this.logAndResolve(resolve, reject, err)
          })
      }
    });
  }

// helper method for logging and resolve
  private logAndResolve(resolve: Function, reject: Function, err ?: any, image ?: IImageModel) {
    let logMessage = `"; Get next image for user.id:"${this.userId}; tags:"${this.tags}"`;

    if (err) {
      Logger.error(logMessage + " - Error:", err);
      reject(err);
    } else {
      Logger.info(logMessage + "; Image found:", `: ${JSON.stringify(image)};QUERY:"${JSON.stringify(this._query)}"`);
      resolve(image ? new ImageModel(image) : null);
    }
  };

  public promiseWhile(condition, action): Promise<any> {
    if (!
      condition()
    ) {
      return Promise.resolve()
    }

    return action()
      .then(() => this.promiseWhile(condition, action))
  }

  public loopUntilFindByPriority(): Promise<IImageModel> {
    return ConfigModel.getConfig()
      .then((configModel) => {
        // TODO: PATCH - skipping priority consideration
        return configModel.getEntityPrioritiesSorted(true)
      })
      .then((sortedEntityIds: string[]) => {
        if (sortedEntityIds.length === 0) {
          Logger.warn(`Fetching next image for user.id=${this.userId} - no entity priorities found, querying by 'createdAt' sorted`);

          return ImageModel.mongoose
            .findOneAndUpdate(this._query, this._updateQuery, this._options)
            .exec()
            .then((image) => {
              return image;
            });
        } else {
          Logger.info(`Fetching next image for user.id=${this.userId} by entity priorities - ${sortedEntityIds.length} priorities exist`);

          let totalEntities: number = sortedEntityIds.length;
          let count: number = 0;
          let nextImage: IImageModel;
          let entityIdsToStopConsider: string[] = [];

          return this.promiseWhile(
            () => {
              return count < totalEntities && !nextImage;
            },
            () => {
              this.augmentOrQuery("entityId", sortedEntityIds[count]);

              Logger.info(`Querying image by entity priorities, query="${JSON.stringify(this._query)}"`);

              return new Promise((resolve, reject) => {
                ImageModel.mongoose
                  .findOneAndUpdate(this._query, this._updateQuery, this._options)
                  .exec((err, image) => {
                    if (err) {
                      Logger.error(`Error querying image for entity, query="${JSON.stringify(this._query)}, err=${err}`);
                      return reject(err);
                    }

                    if (image) { // image found
                      Logger.info(`Querying image by entity priorities - found by entityId="${sortedEntityIds[count]}"`);
                      nextImage = image;
                    } else { // no image found, will ignore current entityId next time
                      Logger.info(`Querying image by entity priorities - no image found for entityId="${sortedEntityIds[count]}", will be skipped in next query`);
                      entityIdsToStopConsider.push(sortedEntityIds[count]);
                    }

                    ++count;
                    resolve();
                  });
              })

            }
          )
            .then(() => {
              if (entityIdsToStopConsider.length > 0)
                Logger.info(`Querying image by entity priorities, setting consider=false for ${entityIdsToStopConsider.length} entities: "${entityIdsToStopConsider.toString()}"`);

              // TODO: PATCH - not setting priority consideration
              // let actions = entityIdsToStopConsider.map((entityId) =>
              //   ConfigModel.getConfig()
              //     .then((configModel) => configModel.setEntityPriorityConsideration(entityId, false))
              // );
              // return Promise.all(actions);

              return Promise.resolve();
            })
            .then(() => nextImage);
        }
      })
  };
}
