import * as request from 'superagent';
import * as responseTime from 'superagent-response-time';
import {Logger} from '../utils/logger';
//import ImageModel from "../models/image/image.model";
import {ICropArea} from "../models/image/image.model.interface";
import metrics from "../utils/metrics";

//TODO: move to another config structure
import * as path from 'path';
//import {resolve} from "url";
const configFilePath = path.resolve(process.cwd(), `${process.env.NODE_CONFIG_DIR}/config.json`);
let Config = require(configFilePath) || {};

let IMAGINARY_IMAGE = `${Config.imaginaryApi.host}${Config.imaginaryApi.apiPath}${Config.imaginaryApi.imageApi}`;

interface ImaginaryInfoMetaData {
	numberOfPages: number;
	pageHeight: number;
	pageWidth: number;
}

interface ImaginaryInfoRes {
  id: string;
  cloudinaryId: string;
	mimeType: string;
	metaData?: ImaginaryInfoMetaData
}

export class ImaginaryService {

  public static getInfo(imageId: string): Promise<ImaginaryInfoRes> {
		let infoApi = `${IMAGINARY_IMAGE}${imageId}${Config.imaginaryApi.infoApi}`;

		return new Promise((resolve:Function, reject:Function) => {
			request
        .get(`${infoApi}`)
        .set("CallingServer", Config.serviceName)
        .timeout({response: Config.imaginaryApi.requestTimeoutMs})
				.end((err, res) => {
					if (err !== null) {
            let message: string;

						if (err.status === 404)
							message = "Image not found on Imaginary service." + JSON.stringify(res);
						else if (err.timeout != null)
							message = "Imaginary get info - " + err.toString();
						else
							message = `Failed to fetch image info from Imaginary service. ${err.toString()}; ${JSON.stringify(res)}`;

            Logger.error(message);

            return reject(new Error(message));
					}

					if (res.status === 200) {
						Logger.debug("Fetched image info from Imaginary: " + JSON.stringify(res));

						return resolve(res.body);
					}	else {
						let message = "Unknown success status returned from Imaginary API. Response: " + JSON.stringify(res);
						Logger.error(message);

						return reject(new Error(message));
					}
				});
		});
  }

  private static manipulateImage(imageId: string, manipulations: object[], vatboxUserId?: string): Promise<ImaginaryInfoRes> {

		let pdfToImageApi = `${IMAGINARY_IMAGE}${imageId}`;
		let measureResponse = (req, ms) => { metrics.gauge("imaginary_manipulation_response_ms", ms.toString())} ;

		return new Promise((resolve:Function, reject:Function) => {
			let requestHeaders: any = {};

			requestHeaders["CallingServer"] = Config.serviceName;
      requestHeaders["Vatbox-User-Id"] = (vatboxUserId && vatboxUserId !== "") ? vatboxUserId : "";

		  request
        .post(`${pdfToImageApi}`)
        .timeout({response: Config.imaginaryApi.requestTimeoutMs})
				.use(responseTime(measureResponse))
        .set(requestHeaders)
				.send(manipulations)
				.end((err, res) => {
					if (err) {
            let message: string;

						if (err.status === 400) {
              metrics.increment("imaginary_manipulation_400");
              message = "Got 'Bad request' trying to manipulate image with Imaginary." + JSON.stringify(res);
            }
            else if (err.timeout != null){
              metrics.increment("imaginary_manipulation_timeout");
              message = `Imaginary manipulate image - (manipulation: ${JSON.stringify(manipulations)}). Error: ${err.toString()}`;
            }
            else {
              metrics.increment("imaginary_manipulation_unknown_error");
							message = "Failed to manipulate image with Imaginary. Error: " + JSON.stringify(err);
						}

            Logger.error(message);

						return reject(new Error(message));
					}

					if (res.status === 200 || res.status === 201) {
						Logger.debug("Imaginary image manipulation succeed: " + JSON.stringify(res));

						return resolve(res.body);
					}	else {
						let message = "Unknown success status returned from Imaginary API. Response: " + JSON.stringify(res);
						Logger.error(message);

						return reject(new Error(message));
					}
				});
		});
  }

	public static pdfToImage(imageId: string): Promise<ImaginaryInfoRes> {
		return ImaginaryService.manipulateImage(imageId, [{
      action: "pdftoimage",
      toMime: Config.imaginaryApi.defaultImageFormat
    }]);
	}

	// auto convert pdf to image if mimeType is pdf
	public static getInfoConverted(imageId: string): Promise<ImaginaryInfoRes> {

		//get the image info
		return ImaginaryService.getInfo(imageId)
			.then((returnVal) => {
				//is this is a PDF file
				if (returnVal.mimeType === "application/pdf") {
					//convert the PDF pages to one tall image
					return ImaginaryService.pdfToImage(imageId);
				} else
					return returnVal;
			});
  }

	public static isImageFile(imageId: string): Promise<boolean> {
    //get the image info
		return ImaginaryService.getInfo(imageId)
			.then((info) => {
				//is this an image file
				return ImaginaryService.isImageType(info)
			});
	}

	public static isImageType(info: ImaginaryInfoRes): boolean {
    let imageMimeTypeValidator = /^image\/\S.*$/; // Regex that searches for string that starts with 'image'
		return imageMimeTypeValidator.test(info.mimeType); // Check if the mimeType starts with 'image'
  }

	public static isMultiPageType(info: ImaginaryInfoRes): boolean {
    let imageMimeTypeValidator = /(pdf|tiff)$/; // Regex that searches for pdf or tiff at the end of a string
		return imageMimeTypeValidator.test(info.mimeType); // Check if the mimeType end with one of the above
	}

	public static createCropImage(imageId: string, cropArea: ICropArea, vatboxUserId?: string): Promise<ImaginaryInfoRes> {
		return ImaginaryService.manipulateImage(imageId, [{
			action: "crop",
      toMime: Config.imaginaryApi.defaultImageFormat,
      parameters: {
				topLeft: [ cropArea.x, cropArea.y	],
				bottomRight: [ cropArea.x.valueOf() + cropArea.width.valueOf(), cropArea.y.valueOf() + cropArea.height.valueOf() ]
			}
		}], vatboxUserId);
  }

}
