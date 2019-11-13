import { ConfigService } from './configService';
import {Logger} from '../utils/logger';
import ImageModel from "../models/image/image.model";
import {ImageTasks} from "../tasks/image.tasks";
import {eImageTask} from "../models/image/image.model.interface";

export class OutboundService {

  private static _config = ConfigService.getConfig('tasks');

  public static startTasksWatcher(forever: boolean): Promise<void> {
    Logger.debug(`Starting recursion of waiting tasks watcher...`);
    return new Promise((resolve, reject) => {

      OutboundService.waitingTasksWatcher(ImageTasks.handler, forever)
      .then(() => { resolve() })
      .catch(err => { reject(err)})
    })
  }

  private static waitingTasksWatcher(handler: (image: ImageModel) => Promise<void>, forever: boolean): Promise<void> {
    let currentImage: ImageModel;
    let currentTask: eImageTask;

    return ImageModel.nextWaitingTask(OutboundService._config.retryIntervalMin, OutboundService._config.maxRetries)
      .then((image) => {
        currentImage = image;

        if (!image){
          Logger.debug(`No image with waiting task, sleep for ${OutboundService._config.delayWhenNoTasksMs}ms before next try`);

          currentTask = null;

          return OutboundService.delay(OutboundService._config.delayWhenNoTasksMs)
        }
        else {
          currentTask = image.nextTask.task;
          Logger.debug(`Handling task ${eImageTask[currentTask]} for image.id=${image.id}`);

          return handler(image);
        }
      })
      .then(() => {
        if (currentImage)
          Logger.info(`Done doing "${eImageTask[currentTask]}" with image.id="${currentImage.id}", looking for next one`);
        else
          Logger.debug(`Done waiting ${OutboundService._config.delayWhenNoTasksMs}ms for available image to recover, try fetch again`);

        if (forever) {
          OutboundService.waitingTasksWatcher(handler, forever)
        } else {
          Logger.debug('OutboundService is not running forver. this service will stop')
        }
      })
      .catch((err) => {
        let message;

        if (currentImage)
          message = `Error doing "${eImageTask[currentTask]}" for image.id=${currentImage.id}`;
        else
          message = `Error while doing a cycle of task watching`;

        Logger.error(message, err);

        // do another one
        if (forever) {
          OutboundService.waitingTasksWatcher(handler, forever);
        } else {
          Logger.debug('OutboundService is not running forver. this service will stop')
        }

        return Promise.reject(new Error(message + JSON.stringify(err)));
      })
  }

  public static delay(ms: number): Promise<void>  {
    return new Promise((resolve, reject) => {
      setTimeout(() => { resolve() }, ms);
    });
  }
}
