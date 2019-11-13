import {Logger} from '../utils/logger';

export class Helpers {

  static isObjectId = (strId): boolean => {
    if (!strId) return false

    return strId.match(/^[0-9a-fA-F]{24}$/) != null;
  };

  static parseDate(date: any): Date {
    if (date == null)
      return null;

    let parsedDate: Date = new Date(date);
    let timestamp: number = Date.parse(date);

    if (parsedDate instanceof Date && isFinite(timestamp))
      return parsedDate;
    else
      return null;
  }

  static subtractMinutesFromNow(minutes: number): number {
    var now = new Date();
    return now.setMinutes(now.getMinutes() - minutes);
  };

  //helper method to create iso date string
  static toIsoDate(time: number): String {
    return new Date(time).toISOString();
  }
}
