import {  Response } from "express";
export interface ResponsePayload<T = unknown> {
  res: Response;
  statusCode?: number;               // default 200
  message?: string;
  data?: T;
  headers?: Record<string, string>;
}

class ResponseResult {

     public sendResponse<T = unknown>({ res, statusCode = 200, message, data, headers }: ResponsePayload<T>) {
        if (headers) {
          Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
        }
        return res.status(statusCode).json({
          status: statusCode,
          message: message ?? "OK",
          data: data ?? null,
        });
      }
}


export const responseResult = new ResponseResult();


