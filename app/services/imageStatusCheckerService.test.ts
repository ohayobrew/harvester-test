import { ImageStatusCheckerService } from './imageStatusCheckerService';
import { DBService } from "./dbService";
import { expect } from "chai";
import ImageModel from '../models/image/image.model';
import * as ModelFactory from '../helpers/tests/modelFactory'
import { eImageStatus } from '../models/image/image.model.interface';
import { ConfigService } from './configService';
import { ImageStatusTaskModel, ImageStatusTask } from '../models/imageStatusTask/imageStatusTask.model';

const MINUTE = 60000

describe('ImageStatusCheckerService', () => {
    let self = this;

    function createAndSave(date): Promise<any> { 
        var imageStatusTaskModel = new ImageStatusTaskModel()
        imageStatusTaskModel.lockedUntil = date
        return imageStatusTaskModel.save().then(doc => new ImageStatusTask(doc))
    }

    function updateDB(lockTime) {
        return ImageStatusTaskModel
            .findOneAndUpdate(self.imageStatusTask.id, {lockedUntil: (new Date(Date.now() + lockTime)).getTime()}, {new: true})
            .then(doc => new ImageStatusTask(doc))
            .then((imageStatusTask) => self.imageStatusTask = imageStatusTask)
    }

    describe('.runTask', () => {
        beforeEach((done) => {
            DBService
                .clearDB()
                .then(() => createAndSave(Date.now()))
                .then((imageStatusTask) => {
                    self.imageStatusTask = imageStatusTask
                    done()
                })
        });

        it('should count the images statuses correctly', (done) => {
            const STATUSES_TO_CHECK = [
                eImageStatus.inProgress,
                eImageStatus.inProgress,
                eImageStatus.rejected,
                eImageStatus.sendingToQueue,
                eImageStatus.sendingToQueue,
                eImageStatus.waitingTask
            ]

            const req = STATUSES_TO_CHECK.map(status =>
                 ImageModel.create(ModelFactory.Factory.generateImage(ModelFactory.imageWithoutStatus, {status})))

            Promise.all(req)
                .then(() => updateDB(MINUTE * (-5))) // unlock to make it permitted
                .then(ImageStatusCheckerService.runTask)
                .then((retObj) => {
                    expect(retObj[eImageStatus.inProgress]).to.equal(2);
                    expect(retObj[eImageStatus.rejected]).to.equal(1);
                    expect(retObj[eImageStatus.sendingToQueue]).to.equal(2);
                    expect(retObj[eImageStatus.waitingTask]).to.equal(1);
                    done();
                })
                .catch(done);
        });

        it('should not count the images statuses - process not permitted', (done) => {
            updateDB(MINUTE * 5)  // lock to make it not permitted
                .then(ImageStatusCheckerService.runTask)
                .then((retObj) => {
                    expect(retObj).to.equal(undefined);
                    done();
                })
                .catch(done);
        });
    });
});