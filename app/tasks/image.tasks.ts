import {Logger} from '../utils/logger';
import {eImageStatus, eImageTask, IImageModel} from "../models/image/image.model.interface";
import ImageModel from '../models/image/image.model';
import {ImaginaryService} from "../services/imaginaryService";
import ImageIntegrations from '../utils/imageIntegrations';
import metrics from '../utils/metrics'

import {isNullOrUndefined} from 'util';
import FeatureService from '../api/v1.0/feature/service/feature.service';
import {ConfigService} from '../services/configService';

const IMAGE_PRE_PROCESS_CONFIG = ConfigService.getConfig('imagePreProcess');
const TASKS_CONFIG = ConfigService.getConfig('tasks');

if (!IMAGE_PRE_PROCESS_CONFIG) {
  throw new Error("Couldn't find 'imagePreProcess' field in config")
}

if (!TASKS_CONFIG) {
  throw new Error("Couldn't find 'tasks' field in config")
}

const MAX_RETRIES = TASKS_CONFIG.maxRetries;

export class ImageTasks {

  static metricPrefix = 'image_task';

  static handler(image: ImageModel): Promise<any> {
    if (!image || !image.nextTask || isNullOrUndefined(image.nextTask.task)) {
      let message = `Image.id="${image ? image.id : "null"}" does not exist or has no waiting task`;
      Logger.error(message);
      metrics.increment(`${ImageTasks.metricPrefix}_failure_image_error`);
      return Promise.reject(message);
    }

    let task: eImageTask = image.nextTask.task;

    switch (task) {
      case eImageTask.multipageConversion:
        return ImageTasks.convertMultiPageToImage(image);
      case eImageTask.processComplete:
        return ImageTasks.completeImage(image);
      case eImageTask.createCropImages:
        return ImageTasks.createCropImages(image);
      case eImageTask.sendToQueue:
        return ImageTasks.sendToQueue(image);
      case eImageTask.createTransactionIds:
        return ImageTasks.createTransactionIds(image);
      case eImageTask.sendToPreProcess:
        return ImageTasks.sendToPreProcess(image);
      case eImageTask.processFinished:
        return ImageTasks.closeTask(image);

      default: {
        let message = `Task: '${task}' not found for image Image.id="${image.id}"`;
        Logger.error(message);
        metrics.increment(`${ImageTasks.metricPrefix}_failure_no_task_found`);
        return Promise.reject(message);
      }
    }
  }

  static logTaskFailure(image: ImageModel, err: any, incrementRetries: boolean = true, setErrorOnMaxRetries: boolean = true) {
    var errors;
    if (Array.isArray(err)) {
      errors = err
    } else if (err.message) {
      errors = [err.message]
    } else {
      errors = [err]
    }

    const task = image.nextTask.task;
    Logger.error(`Failed completing task="${eImageTask[task]}" for image.id=${image.id}, Error: ${JSON.stringify(err)}`);

    metrics.increment(`${ImageTasks.metricPrefix}_process_task_failure`);
    metrics.increment(`${ImageTasks.metricPrefix}_process_task_fail_for_${task}`);
    return image
      .logTaskFailure(errors, task, incrementRetries)
      .then((updatedImage) => {
        if (updatedImage.nextTask.retries >= MAX_RETRIES && setErrorOnMaxRetries) {
          return image.setError(task)
        }

        return Promise.resolve(null)
      })
      .catch((err) => Promise.reject(err))
  }

  static updateMetrics(image: IImageModel) {
    const task = image.nextTask.task;
    Logger.debug(`Successfully done task="${eImageTask[task]}" for image.id=${image.id}`);

    metrics.increment(`${ImageTasks.metricPrefix}_success_total`);
    metrics.increment(`${ImageTasks.metricPrefix}_success_for_${task}`)
  }

  static changeStatus = (image: ImageModel, status: eImageStatus): Promise<string[]> => {
    if (!image) {
      let logMessage = `ImageIntegrations: Image could not be null or undefined!`;
      Logger.warn(logMessage);
      return Promise.reject([logMessage]);
    }

    if (status === eImageStatus.done) metrics.increment("done_reports");

    return ImageModel.updateStatus(image, image.activeUser, status, null, null)
      .then((statusChanged) =>
        statusChanged ? Promise.resolve(null) : Promise.reject(["Could not change status to " + eImageStatus[status]]))
  };

  // recover image that had an error while completing
  // it will do the whole process of completing image again, while skipping already done parts
  // (like image already created for some crop areas)
  static completeImage(image: ImageModel): Promise<void> {
    return ImageTasks.changeStatus(image, eImageStatus.sendingToQueue)
      .then(() => ImageModel.updateTaskCompleted(image, eImageTask.processComplete, eImageTask.createCropImages))
      .then(() => Logger.info(`ImageTask: next task for image id: ${image.id} updated`))
      .catch((err) => ImageTasks.logTaskFailure(image, err));
  };

  static closeTask(image: ImageModel) {
    return ImageTasks.changeStatus(image, eImageStatus.done)
      .then(() => image.closeTask())
      .then(() => ImageTasks.updateMetrics(image))
      .catch((err) => ImageTasks.logTaskFailure(image, err));
  }

  static createCropImages(image: ImageModel): Promise<void> {
    Logger.info(`ImageTask: starting to create crop images to image: ${image.id}`);
    return ImageIntegrations.createCropImages(image)
      .then(() => ImageModel.updateTaskCompleted(image, eImageTask.createCropImages, eImageTask.createTransactionIds))
      .then(() => Logger.info(`ImageTask: finisehd to create crop images to image: ${image.id}`))
      .catch((err) => ImageTasks.logTaskFailure(image, err))
  }

  static createTransactionIds(image: ImageModel): Promise<void> {
    Logger.info(`ImageTask: starting to create transaction ids to image: ${image.id}`);
    return ImageIntegrations.createTransactionIds(image)
      .then(() => ImageModel.updateTaskCompleted(image, eImageTask.createTransactionIds, eImageTask.sendToPreProcess))
      .then(() => Logger.info(`ImageTask: finisehd to create transaction ids to image: ${image.id}`))
      .catch((err) => ImageTasks.logTaskFailure(image, err));
  }

  static sendToQueue(image: ImageModel): Promise<void> {
    Logger.info(`ImageTask: starting to send to queue image id: ${image.id}`);
    return ImageIntegrations.sendToQueue(image)
      .then(() => ImageModel.updateTaskCompleted(image, eImageTask.sendToQueue, eImageTask.processFinished))
      .then(() => Logger.info(`ImageTask: finisehd to create transaction ids to image: ${image.id}`))
      .catch((err) => ImageTasks.logTaskFailure(image, err));
  }

  static sendToPreProcess(image: ImageModel) {
    Logger.info(`ImageTask: starting to send image id: ${image.id} to pre process`);

    return FeatureService.isFeatureOn(IMAGE_PRE_PROCESS_CONFIG.featureName)
      .then(isFeatureOn => {
        if (!isFeatureOn) {
          Logger.debug(`feature '${IMAGE_PRE_PROCESS_CONFIG.featureName}' is off, skipping pre-processing`);
          return ImageModel.updateTaskCompleted(image, eImageTask.sendToPreProcess, eImageTask.sendToQueue)
        }

        return ImageIntegrations.sendToPreProcess(image)
          .then(() => ImageModel.updateTaskCompleted(image, eImageTask.sendToPreProcess, eImageTask.sendToQueue))
          .catch(err => {
            return ImageTasks.logTaskFailure(image, err, true, false)
              .then((res) => {
                const retries = image.nextTask.retries || 0;
                if (retries < MAX_RETRIES) {
                  return res
                }

                Logger.debug(`ImageTasks.sendToPreProcess: The number of retures exceeded the maximum. skipping preprocess to image id: ${image.id}`);
                metrics.increment(`pre_process_skipping_due_to_retries`);
                return ImageModel.updateTaskCompleted(image, eImageTask.sendToPreProcess, eImageTask.sendToQueue).then(() => res)
              })

          })
      })
      .catch(error => ImageTasks.logTaskFailure(image, error, false, false))
  }

  static convertMultiPageToImage(image: ImageModel): Promise<void> {
    if (!image) return Promise.reject("Image Multipage for converting process can't be null");

    Logger.debug(`Start converting process of image.id=${image.id}`);
    return ImaginaryService.pdfToImage(image.imaginaryIdOriginal)
      .then((res) => ImageModel.updateCropAreaImage(image, res.id, res.cloudinaryId, res.mimeType))
      .then(() => ImageModel.updateStatus(image, image.activeUser, eImageStatus.waitingTask, null, null))
      .then(() => Logger.info(`ImageTask: finisehd to convert multi page to image: ${image.id} to pre process`))
      .catch((error) => ImageTasks.logTaskFailure(image, error));
  }
}

