import {  Response } from "express";
export interface ErrorPayload {
  res: Response;
  statusCode?: number;               // default 500
  message?: string;
  details?: unknown;                 // optional structured error info (not stack)
}
class ErrorResponse {

      public sendError({ res, statusCode = 500, message, details }: ErrorPayload) {
         return res.status(statusCode).json({
           status: statusCode,
           message: message ?? "Something went wrong",
           error: details ?? null,
         });
       }
}


export const errorResponse = new ErrorResponse();