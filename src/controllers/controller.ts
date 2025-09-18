import {  RequestHandler, Router, Response } from 'express';



export abstract class Controller {
  public readonly router: Router;

  constructor() {
    this.router = Router();
  }

  

 

  // Wrap async handlers to forward errors to your error middleware
  protected asyncHandler =
    (fn: RequestHandler) =>
    ((req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    }) as RequestHandler;





    
}


