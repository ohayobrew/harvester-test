
import * as mongoose from 'mongoose'
import {IImageStatusTask, IImageStatusTaskModelMongoose} from './imageStatusTaskModel.interface'
import { ConfigService } from '../../services/configService'

let _schema = new mongoose.Schema({
    lockedUntil: Date
});

export const ImageStatusTaskModel: mongoose.Model<IImageStatusTaskModelMongoose> = mongoose.model<IImageStatusTaskModelMongoose>("Image_Status_Task", _schema);

export class ImageStatusTask implements IImageStatusTask {

    private _model;

    constructor(model) {
        this._model = model
    }

    get lockedUntil(): Date {
        return this._model.lockedUntil;
    }

    get id(): String {
        return this._model._id.toString();
    }
}
