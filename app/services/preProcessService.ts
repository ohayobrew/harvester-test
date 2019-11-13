import { ConfigService } from './configService';
import * as request from 'superagent';
import {Logger} from '../utils/logger';
import metrics from "../utils/metrics";
import { resolve } from 'path';

const serviceName = ConfigService.getConfig('serviceName')
const IMAGE_PRE_PROCESS_CONFIG = ConfigService.getConfig('imagePreProcess')
const IMAGINARY_CONFIG = ConfigService.getConfig('imaginaryApi')


if (!IMAGE_PRE_PROCESS_CONFIG){
  throw new Error("Couldn't find 'imagePreProcess' field in config")
}

if (!IMAGINARY_CONFIG){
	throw new Error("Couldn't find 'imaginaryApi' field in config")
}

const imaginaryUrl = IMAGINARY_CONFIG.publicHost + IMAGINARY_CONFIG.clientsApiPath

export class PreProcessService {

  public static manipulateImage(imaginaryId: string): Promise<any> {
		const requestHeaders = {
			"Content-Type": 'application/json',
			'Accept': 'application/json'
		}

		if (serviceName != null && serviceName !== "") {
			requestHeaders["CallingServer"] = serviceName;
		}

		return new Promise( (resolve, reject) => {
			request
			.post(`${IMAGE_PRE_PROCESS_CONFIG.apiUrl}`)
			.timeout({response: IMAGE_PRE_PROCESS_CONFIG.requestTimeoutMs})
			.set(requestHeaders)
			.send({"url":`${imaginaryUrl}/${imaginaryId}`})
			.end((err, res) => {
				if (err) {
					let message: string;

					if (err.status === 400) {
						metrics.increment("imagePreProcess_manipulation_400");
						message = "Got 'Bad request' trying to manipulate image with ImagePreProcess." + JSON.stringify(res);
					}
					else if (err.timeout != null){
						metrics.increment("imagePreProcess_manipulation_timeout");
						message = `ImagePreProcess manipulate image timeout. Error: ${err.toString()}`;
					}
					else {
						metrics.increment("imagePreProcess_manipulation_prism_internal_error");
						message = "Failed to manipulate image with ImagePreProcess. Prism internal error: " + JSON.stringify(err);
					}

					Logger.error(message);
					return reject(new Error(message));
				}

				if (res.status === 200 || res.status === 201) {
					Logger.debug("ImagePreProcess image manipulation succeed: " + JSON.stringify(res));
					return resolve({actions: res.body.actions});

				}	else {
					let message = "Unknown success status returned from ImagePreProcess API. Response: " + JSON.stringify(res);
					Logger.error(message);
					return reject(new Error(message));
				}
			});
		})
  }
}
