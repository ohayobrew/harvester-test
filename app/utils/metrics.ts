"use strict";
// this code took from node-metrics

var StatsD = require('hot-shots');
var LynxExpress = require('lynx-express');

interface IMetrics {
    setLogger(logger: any): void;
    getExpressMiddleware(): any;
    increment(name: string, sampleRate?: number, tags?: any): void;
    histogram(name: string, value?: any): void;
    set(name: string, value: string): void;
    gauge(name: string, value: string, sampleRate?: number, tags?: string[]): void;
}

class Metrics implements IMetrics {
    private static _instance: IMetrics;
    private _options;
    private _client;
    private _logger;

    constructor() {
        this._options = {
            host: process.env.STATSD_HOST,
            port: process.env.STATSD_PORT,
            prefix: process.env.STATSD_PREFIX
        };
        console.log("Metrics options are set as: " + JSON.stringify(this._options));
        this._options.mock = process.env.NODE_ENV === 'test';
        this._client = new StatsD(this._options);
    }

    public static get Instance(): IMetrics {
        return this._instance || (this._instance = new Metrics());
    }

    setLogger(logger: any): void {
        this._logger = logger;
    };

    getExpressMiddleware(): any {
        return LynxExpress(this._client);
    };

    increment(name: string, sampleRate?: number, tags?: any): void {
        var _this = this;
        this._logger && this._logger.debug("NM increment: " + name + ", sampleRate: " + sampleRate + ", tags: " + tags);
        this._client.increment(name, null, sampleRate, tags, function (err, bytes) {
            if (err)
                _this._logger && _this._logger.warn(err);
            else
                _this._logger && _this._logger.debug("NM increment callback: " + name + ", bytes: " + bytes);
        });
    }

    histogram(name: string, value?: any): void {
        var _this = this;
        this._logger && this._logger.debug("NM histogram: " + name);
        if (!value) {
            value = 1;
        }
        this._client.histogram(name, value, null, null, function (err, bytes) {
            if (err)
                _this._logger && _this._logger.warn(err);
            else
                _this._logger && _this._logger.debug("NM histogram callback: " + name + ", bytes: " + bytes);
        });
    }

    set(name: string, value: string): void {
        var _this = this;
        this._logger && this._logger.debug("NM set: \"" + name + "\" value: " + value);
        this._client.set(name, value, null, null, function (err, bytes) {
            if (err)
                _this._logger && _this._logger.warn(err);
            else
                _this._logger && _this._logger.debug("NM set callback: " + name + ", bytes: " + bytes);
        });
    }

    gauge(name: string, value: string, sampleRate?: number, tags?: any): void {
        var _this = this;
        this._logger && this._logger.debug("NM gauge: " + name + ", sampleRate: " + sampleRate + ", tags: " + tags);
        this._client.gauge(name, value, sampleRate, tags, function (err, bytes) {
            if (err)
                _this._logger && _this._logger.warn(err);
            else
                _this._logger && _this._logger.debug("NM gauge callback: " + name + ", bytes: " + bytes);
        })
    }
}

const metrics = Metrics.Instance

export default metrics
