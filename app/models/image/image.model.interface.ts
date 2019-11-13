import * as mongoose from 'mongoose';

export interface IImageModel {
  id?: string;
  cloudinary?: ICloudinary;
  clientUrl?: string;
  tsSubmitted?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  activeUser?: string;
  doneAt?: Date;
  doneByUser?: string;
  detectedAt?: Date;
  detectedByUser?: string;
  detectionCount?: number,
  rejectedAt?: Date;
  rejectedByUser?: string;
  tags?: string[];
  cropAreas?: ICropArea[];
  comment?: string;
  status?: eImageStatus;
  rails?: IRails;
  entityId?: string; // in rails, represent company id
  imaginaryId?: string;
  source?: string;
  lastError?: IError;
  imaginaryIdOriginal?: string; // imaginaryId as got in create request, before any manipulation occurred
  nextTask?: INextTask;
  reportId?: string; // duplication of "scapegoat.reportId". need a future data modification
  requestMetadata?: IRequestMetadata;
  transactionId?: string; // in use when done without cropAreas
  skippedCrop?: boolean;
  skippedCropReason?: eSkippedCropReason;
  requestedSkipCrop?: boolean;
  forced?: boolean;
  cropAreasOriginId?: string;
  singleImage?: string;
  reCalc?: boolean;
  completedTasks?: eImageTask[];
}

export interface IImageModelMongoose extends IImageModel, mongoose.Document {
  id?: string;
};

export interface ICropArea {
  id?: string;
  createdAt: Date;
  updatedAt?: Date;
  createdByUserId?: string;
  cloudinary?: ICloudinary;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  status?: eCropAreaStatus;
  imaginaryId?: string;
  invoiceId?: string; // obsolete - no existing flow needs to create invoices directly in rails anymore
  invoiceCreatedAt?: Date;
  queue?: ISqsEnqueue;
  preProcess?: IPreProcess;
}

export interface IPreProcess {
  actions?: string[]
}

export interface IPreProcessError {
  ts: Date,
  msg: string
}

export interface IRails {
  bulkId?: string;
  bulkCreatedAt?: Date;
}

export interface IRequestMetadata {
  workloadId?: string;
  reportId?: string;
  transactionId?: string;
  companyId?: string;
  version?: string;
}

export interface ICloudinary {
  publicId?: string;
  version?: string;
  format?: string;
}

export interface ISqsEnqueue {
  enqueuedAt?: Date;
  messageId?: string;
  transactionId?: string;
}

export interface IError {
  message?: string;
  occurredAt?: Date;
  task?: eImageTask;
}

export interface INextTask {
  task?: eImageTask;
  errorLog?: IError[]; // log of all errors occurred, not just for current task
  retries?: number; // zero or undefined means success on first try
  lastRetry?: Date;
}

/*
   inProgress - ready for user to do crop process
   done - all crop areas created and submitted (to rails/expedite/matcher)
   rejected - rejected by user
   creatingInvoices - middle state while communicating with rails
   failedCreatingAllInvoices - not in use
   error - had an error
   sendingToQueue - middle state while sending to queue
   waitingTask - status for queueing task for later. set nextTask.task with the desired one
   potentiallyBadFile - an image file that failed to load in the back office
   badFile - A potentiallyBadFile that has > config.retryCounts occurrence
*/
export enum eImageStatus {
  inProgress = 'inProgress',
  done = 'done',
  rejected = 'rejected',
  creatingInvoices = 'creatingInvoices',
  failedCreatingAllInvoices = 'failedCreatingAllInvoices',
  error = 'error',
  sendingToQueue = 'sendingToQueue',
  waitingTask = 'waitingTask',
  manuallyIgnored = 'manuallyIgnored',
  badFile = 'badFile',
  potentiallyBadFile = 'potentiallyBadFile'
}

export enum eImageTask {
  processComplete = 'processComplete',
  multipageConversion = 'multipageConversion',
  createCropImages = 'createCropImages',
  createTransactionIds = 'createTransactionIds',
  sendToPreProcess = 'sendToPreProcess',
  sendToQueue = 'sendToQueue',
  processFinished = 'processFinished'
}

export enum eCropAreaStatus {
  fresh = 'fresh',
  invoiceCreated = 'invoiceCreated'
}

export enum eSkippedCropReason {
  image = 'image',
  multiPages = 'multiPages',
  reCalc = 'reCalc'
}
