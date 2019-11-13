import {eImageStatus} from '../models/image/image.model.interface'
import ImageService from '../api/v1.0/image/service/imageService'
import { ConfigService } from '../services/configService'
import {Logger} from '../utils/logger'
import {ImageStatusTaskModel} from '../models/imageStatusTask/imageStatusTask.model'
import metrics from '../utils/metrics';

const MINUTE = 60000
const imageStatusChecker = ConfigService.getConfig('imageStatusChecker')
if (!imageStatusChecker){
    throw new Error("Couldn't found 'imageStatusChecker' field in config")
}
export class ImageStatusCheckerService {
    
    private static STATUSES_TO_CHECK = [
        eImageStatus.inProgress, 
        eImageStatus.rejected, 
        eImageStatus.sendingToQueue, 
        eImageStatus.waitingTask
    ]

    public static run(forever: boolean) {
        Logger.info(`ImageStatusChecker is running...`);
        
        const at = imageStatusChecker.runEveryMinutes * MINUTE
        const doTask = () => {
            Logger.debug(`ImageStatusChecker: running task`);
            ImageStatusCheckerService.runTask()
                .then(() => {
                    if (forever) {
                        Logger.debug(`ImageStatusChecker: registering for next run`);
                        setTimeout(doTask, at)
                    } else {
                        Logger.debug(`ImageStatusChecker: proccess finished and will terminate`);
                    }
                })
        }

        setTimeout(doTask, 0) // first run will be immediately
    }

    private static createLock(): Promise<boolean> {
        const lockTime = MINUTE * imageStatusChecker.dbLockMinutes
        const miliseconds = Date.now()

        return new Promise((resolve, reject) => {
            ImageStatusTaskModel.findOneAndUpdate(
                {lockedUntil: {$lt: Date.now()}},
                { $set: {lockedUntil: (new Date(miliseconds + lockTime)).getTime()}},
                { new: true }
            )
            .then( res => {
                if (res) {
                    Logger.debug(`ImageStatusChecker: createLock - success to lock`);
                    resolve(true)
                } else {
                    Logger.debug(`ImageStatusChecker: createLock - already locked`);
                    resolve(false)
                }
            })
            .catch( err => {
                Logger.error(`ImageStatusChecker: createLock had error: `, err);
                resolve(false)
            })
        })
    }

    public static runTask(): Promise<any> {
        return ImageStatusCheckerService.createLock()
            .then( isPermitted => {
                if (!isPermitted) return Promise.reject(null)
                return ImageService.getImagesStatuses(ImageStatusCheckerService.STATUSES_TO_CHECK)
                    .then(results => {
                        Logger.debug(`ImageStatusChecker: runTask created lock succefully`);
                        
                        Logger.debug(`sending metrics: `, JSON.stringify(results));
                        ImageStatusCheckerService.STATUSES_TO_CHECK
                            .forEach( status => {
                                const total = results[status] || 0
                                metrics.gauge(`images_with_status_${status}`, total)
                            })

                        return results
                    })
            })
            .catch( (error) => {
                if (error) {
                    Logger.error(`error occure while checking images statuses count: `, error);
                } else {
                    Logger.debug(`ImageStatusChecker: proccess not permitted to run task`);
                }
            })
    }
}