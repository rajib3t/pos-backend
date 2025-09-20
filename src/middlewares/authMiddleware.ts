import { Request, Response, NextFunction } from "express";
import TokenService from "../services/token.service";
import { errorResponse } from "../utils/errorResponse";
import jwt from 'jsonwebtoken';
import { responseResult } from "../utils/response";
import Logging from "../libraries/logging.library";
// Extend Express Request interface to include userId and userType
declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
    // userType?: string;
    // organizationId?: string; // Add organizationId to the request
  }
}

class AuthMiddleware {
    private static instance: AuthMiddleware;
    private tokenService: TokenService;
    constructor() {
        this.tokenService = TokenService.getInstance();
        Logging.info("AuthMiddleware initialized with TokenService instance");
        this.handle = this.handle.bind(this);
    }
    public static getInstance(): AuthMiddleware {
        if (!AuthMiddleware.instance) {
            AuthMiddleware.instance = new AuthMiddleware();
        }
        return AuthMiddleware.instance;
    }


    public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        const token: string | undefined = req?.headers?.authorization?.split(' ')[1];
        // Check for user impersonation header
        const userId = req.headers['x-user-id'] as string;

        //this.tokenService = TokenService.getInstance();
        try {
            if (!token) {
                responseResult.sendResponse({
                    res,
                    statusCode: 401,
                    message: 'Unauthorized',
                    data: null
                });
                return;
            }
            const tokenVerify = await this.tokenService.verifyToken(token);
            
            // Ensure token verification succeeded and contains payload
            if (!tokenVerify || typeof tokenVerify !== 'object' || !(tokenVerify as any).exp) {
                responseResult.sendResponse({
                    res,
                    statusCode: 401,
                    message: 'Unauthorized',
                    data: null
                });
                return;
            }

            // Prefer impersonation header if provided, else fallback to token payload
            const payloadUserId = (tokenVerify as any).userId as string | undefined;
            req['userId'] = userId || payloadUserId;

            if (!req['userId']) {
                responseResult.sendResponse({
                    res,
                    statusCode: 401,
                    message: 'Unauthorized',
                    data: null
                });
                return;
            }
           
            next();
        } catch (error) {
            console.error('Token verification error:', error);

            errorResponse.sendError({
                res,
                statusCode: 500,
                message: 'Internal server error',
            });
            return;
        }
    }
}


export default AuthMiddleware;