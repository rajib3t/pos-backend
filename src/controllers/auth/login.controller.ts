import { Request, Response } from "express";
import { Controller } from "../controller";

import UserService from "../../services/user.service";
import TokenService from "../../services/token.service";
import Logging from "../../libraries/logging.library";
import { comparePassword } from "../../utils/passwords";
import { responseResult } from "../../utils/response";
import {errorResponse} from "../../utils/errorResponse"
import ValidateMiddleware from '../../middlewares/validate'
import { loginSchema } from "../../validators/auth.validator";
import EventService from "../../events/EventService";
import { cookieConfig } from "../../config";
import StoreMembershipService from "../../services/store/storeMembership.service";
class LoginController extends Controller {
    private userService: UserService;
    private tokenService: TokenService;
    private storeMemberService : StoreMembershipService 
    constructor() {
        super();
        this.router.post('/login', ValidateMiddleware.getInstance().validate(loginSchema), this.asyncHandler(this.login));
        this.router.post('/logout', this.asyncHandler(this.logout));
        this.router.post('/refresh', this.asyncHandler(this.refreshToken));
        this.userService = UserService.getInstance();
        this.tokenService = TokenService.getInstance();
        this.storeMemberService = StoreMembershipService.getInstance();
    }

    /**
     * Validate tenant context exists (but allow landlord requests)
     */
    private validateTenantContext(req: Request): void {
        if (!req.tenantConnection) {
            throw new Error('Database connection is required');
        }
    }

    /**
     * Get context info for logging
     */
    private getContextInfo(req: Request): string {
        if (req.isLandlord) {
            return 'landlord (main database)';
        }
        return `tenant ${req.tenant?.subdomain}`;
    }

    private login = async (req: Request, res: Response) => {
        this.validateTenantContext(req);
       
        
        
        const { email, password } = req.body;

        // Validate user input
        if (!email || !password) {
            return errorResponse.sendError({ res, statusCode: 400, message: "Email and password are required" });
        }

        try {
            let user;

            if (req.isLandlord) {
                // Landlord request - use main database
                user = await this.userService.findByEmail(email);
            } else {
                // Tenant request - use tenant database
                user = await this.userService.findByEmail(req.tenantConnection!, email);
            }

            if (!user || !user.password) {
                // Emit failed login attempt
                EventService.emitLoginAttempt({
                    email,
                    success: false,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                    tenantId: req.tenant?._id as string,
                    errorReason: 'User not found'
                }, EventService.createContextFromRequest(req));

                return errorResponse.sendError({ res, statusCode: 401, message: "Invalid email or password" });
            }

            const isPasswordValid = await comparePassword(password, user.password);
            if (!isPasswordValid) {
                // Emit failed login attempt
                EventService.emitLoginAttempt({
                    email,
                    success: false,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                    tenantId: req.tenant?._id as string,
                    errorReason: 'Invalid password'
                }, EventService.createContextFromRequest(req));

                return errorResponse.sendError({ res, statusCode: 401, message: "Password is incorrect" });
            }

            const options = {
                httpOnly: true,
                secure: true,
                domain: req.isLandlord ? `${cookieConfig.baseDomain}` : `${req.headers['x-tenant-subdomain']}.${cookieConfig.baseDomain}`,
                sameSite: 'none' as const,
                partitioned: true // <-- new attribute
            }


            
            // Enhanced token payload with context information
            const tokenPayload = {
                userId: user._id,
                email: user.email,
                context: req.isLandlord ? 'landlord' : 'tenant',
                subdomain: req.subdomain || 'landlord',
                tenantId: req.tenant?._id || null,
                timestamp: new Date().getTime()
            };

            // Use appropriate database for token storage based on context
            const connection = req.isLandlord ? null : req.tenantConnection;
            
            const accessToken = await this.tokenService.generateToken(tokenPayload);
            const refreshToken = await this.tokenService.generateRefreshToken(tokenPayload, connection);
            const stores = await this.storeMemberService.findByUser(connection!, user._id as string, 'pending');
            if(stores.length > 0) {
                const store = stores[0];
                
            }
            
            const response = { 
                email: user.email, 
                name: user.name, 
                id: user._id,
                context: req.isLandlord ? 'landlord' : 'tenant',
                subdomain: req.subdomain || 'landlord',
                tenantId: req.tenant?._id || null,
                tenantName: req.tenant?.name || 'Landlord',
                permissions: req.isLandlord ? ['admin', 'landlord'] : ['tenant'],
                loginTime: new Date().toISOString(),
                role:user.role
            };
            let userResponse;
            if(stores.length > 0) {
                   userResponse = {
                    ...response,
                    store:stores[0]
                }
            }else{
                 userResponse = {
                    ...response,
                    store:null
                }
            }

            const loginData = { accessToken, user: userResponse, refreshToken };
            
            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: true,
                sameSite: "none",
                partitioned: true
            });

            res.cookie("accessToken", accessToken, {
                httpOnly: true,
                secure: true,
                sameSite: "none",
                partitioned: true
            });

            // Emit successful login event
            EventService.emitUserLogin({
                userId: user._id as string,
                email: user.email,
                loginTime: new Date(),
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                tenantId: req.tenant?._id as string
            }, EventService.createContextFromRequest(req));

            // Emit successful login attempt
            EventService.emitLoginAttempt({
                email,
                success: true,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                tenantId: req.tenant?._id as string
            }, EventService.createContextFromRequest(req));

            // Emit token creation event
            EventService.emitTokenCreated({
                userId: user._id as string,
                type: 'access',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
            }, EventService.createContextFromRequest(req));
            
            
            return responseResult.sendResponse({ res, data: loginData, message: "Login successful" });
        } catch (error) {
            Logging.error(`Login error in ${this.getContextInfo(req)}: ${error}`);
            return errorResponse.sendError({ res, statusCode: 500, message: "Internal server error" });
        }
    }


    private logout = async (req: Request, res: Response) => {
        
        const incomingRefreshToken = req.body.refreshToken || req.cookies.refreshToken.token;
        if (!incomingRefreshToken) {
            return errorResponse.sendError({ res, statusCode: 400, message: "Refresh token is required" });
        }
       
        try {
            // Use appropriate database context for token invalidation
            const connection = req.isLandlord ? null : req.tenantConnection;
            
            await this.tokenService.invalidateRefreshToken(incomingRefreshToken, connection);
            res.clearCookie("refreshToken");
            res.clearCookie("accessToken");

            // Emit user logout event
            EventService.emitUserLogout(
                req.userId || 'unknown',
                EventService.createContextFromRequest(req)
            );

            Logging.info(`User logged out from ${this.getContextInfo(req)}`);
            return responseResult.sendResponse({ res, message: "Logout successful" });
        } catch (error) {
            Logging.error(`Error logging out user: ${error}`);
            return errorResponse.sendError({ res, statusCode: 500, message: "Internal server error" });
        }
    }


    private refreshToken = async (req: Request, res: Response) => {
        const incomingRefreshToken =  req.body.refreshToken ||  req.cookies.refreshToken.token;
        if (!incomingRefreshToken) {
            return errorResponse.sendError({ res, statusCode: 400, message: "Refresh token is required" });
        }

       
        try {
            // Use appropriate database context for token refresh
            const connection = req.isLandlord ? null : req.tenantConnection;
            
            const newAccessToken = await this.tokenService.refreshTheAccessToken(incomingRefreshToken, connection);
            
            Logging.info(`Token refreshed for ${this.getContextInfo(req)}`);
            

            return responseResult.sendResponse({ res, data: { accessToken: newAccessToken.token , refreshToken: {
                token: incomingRefreshToken,
                expiresAt: newAccessToken.refreshTokenExpiry
            }}, message: "Token refreshed successfully" });
        } catch (error) {
            Logging.error(`Error refreshing token: ${error}`);
            return errorResponse.sendError({ res, statusCode: 500, message: "Internal server error" });
        }
    }
}

export default new LoginController().router;