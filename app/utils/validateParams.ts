import {Logger} from '../utils/logger';
import {Deserializer} from '../utils/deserializer';

interface ImageQueryParams {
  limit: number;
  offset: number;
  query: any;
}

export class ValidateParams {
  static imagesQuery = (limit: string, offset: string, queryParams: any): ImageQueryParams => {

    let paginationScope = Deserializer.paginationScope(limit, offset);

    if (paginationScope == null) {
      let logMessage = "Querying images with illegal pagination values";
      Logger.error(logMessage);
      return null;
    }

    if (queryParams.status != null && Deserializer.imagesStatusBleach(queryParams.status) == null) {
      let logMessage = `"${queryParams.status}" is an illegal status`;
      Logger.warn(logMessage);
      return null;
    }

    let deserializedQueryParams = Deserializer.imagesQueryParams(queryParams);

    if (Object.keys(deserializedQueryParams).length  === 0 ){
      let logMessage = "No acceptable query params supplied";
      Logger.warn(logMessage);
      return null;
    }

    return {
      limit: paginationScope.limit,
      offset: paginationScope.offset,
      query: deserializedQueryParams
    };
  };
}
