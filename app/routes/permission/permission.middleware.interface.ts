import * as express from 'express';

export default interface PermissionMiddleware {
    (activity: string): express.RequestHandler;
}