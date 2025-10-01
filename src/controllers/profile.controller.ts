import { NextFunction, Request, Response } from "express";

import { Controller } from "./controller";
import Logging from "../libraries/logging.library";
import UserService from "../services/user.service";
import { responseResult } from "../utils/response";
import { errorResponse } from "../utils/errorResponse";
import { IAddress } from "../models/address.model";
import AddressRepository from "../repositories/address.repository";
import { IUser } from "../models/user.model";
import { comparePassword, hashPassword } from "../utils/passwords";
import { profileUpdateSchema, validateEmailUniqueness } from "../validators/user.validator";
import ValidateMiddleware from "../middlewares/validate";
import database, { IDatabase } from "../database";
import CacheMiddleware from "../middlewares/cache.middleware";
import CacheService from "../services/cache.service";
import EventEmissionMiddleware from "../middlewares/eventEmission.middleware";
import EventService from "../events/EventService";
import DataSanitizer from "../utils/sanitizeData";

class ProfileController extends Controller {
     private userService: UserService;
        private database!: IDatabase;
     constructor() {
        super();
        this.initializeRoutes();
        this.userService = UserService.getInstance();
    }

    private initializeRoutes() {
        // Get profile with caching and rate limiting
        this.router.get(
            "/", 
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                maxRequests: 100,
                keyGenerator: (req) => `profile:get:${req.userId}:${req.ip}`
            }),
            CacheMiddleware.cache({
                ttl: 300, // 5 minutes
                prefix: 'profile',
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain || 'unknown';
                    return `detail:${req.userId}:${context}`;
                }
            }),
            EventEmissionMiddleware.forRead('profile'),
            this.asyncHandler(this.index)
        );

        // Update profile with rate limiting and cache invalidation
        this.router.patch(
            "/", 
            ValidateMiddleware.getInstance().validate(profileUpdateSchema),
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                maxRequests: 20,
                keyGenerator: (req) => `profile:update:${req.userId}:${req.ip}`
            }),
            CacheMiddleware.invalidate((req) => {
                const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain || 'unknown';
                return [
                    `profile:detail:${req.userId}:${context}`,
                    `profile:stats:*`
                ];
            }),
            EventEmissionMiddleware.forUpdate('profile'),
            this.asyncHandler(this.updateProfile)
        );

        // Update password with rate limiting and cache invalidation
        this.router.patch(
            "/password", 
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000, // 1 hour
                maxRequests: 5,
                keyGenerator: (req) => `profile:password:${req.userId}:${req.ip}`
            }),
            CacheMiddleware.invalidate((req) => {
                const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain || 'unknown';
                return [`profile:detail:${req.userId}:${context}`];
            }),
            EventEmissionMiddleware.createEventMiddleware({
                resource: 'profile',
                operation: 'update',
                customEventName: 'profile.password.updated'
            }),
            this.asyncHandler(this.updatePassword)
        );

        // Cache management endpoints
        this.router.post(
            "/cache/clear",
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000, // 1 hour
                maxRequests: 10,
                keyGenerator: (req) => `profile:cache:clear:${req.ip}`
            }),
            this.asyncHandler(this.clearCache)
        );

        this.router.get(
            "/cache/stats",
            CacheMiddleware.rateLimit({
                windowMs: 60 * 1000, // 1 minute
                maxRequests: 30,
                keyGenerator: (req) => `profile:cache:stats:${req.ip}`
            }),
            this.asyncHandler(this.getCacheStats)
        );

        // Profile statistics endpoint
        this.router.get(
            "/stats",
            CacheMiddleware.cache({
                ttl: 300, // 5 minutes
                prefix: 'profile',
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain || 'unknown';
                    return `stats:${context}`;
                }
            }),
            this.asyncHandler(this.getProfileStats)
        );
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

        /**
         * Get appropriate address repository based on context
         */
        private getAddressRepository(req: Request): AddressRepository {
            if (req.isLandlord) {
                // Landlord context - use master database
                return new AddressRepository();
            } else {
                // Tenant context - use tenant database
                return new AddressRepository(req.tenantConnection!);
            }
        }

    private index = async (req: Request, res: Response) => {
        this.validateTenantContext(req);
        
        const userId = req.userId; // Access the userId from the request object
       
        try{
            let userProfile;
             const addressRepository = this.getAddressRepository(req);
            if (req.isLandlord) {
                // Landlord request - use main database
                userProfile = await this.userService.getUserProfile(userId as string);
            } else {
                // Tenant request - use tenant database
                userProfile = await this.userService.getUserProfile(req.tenantConnection!, userId as string);
            }
            
            if (!userProfile) {
                return errorResponse.sendError({
                    res,
                    statusCode: 404,
                    message: "User profile not found",
                });
            }

            const userAddress = await addressRepository.findByUserId(userId as string);

            const userProfileData = {
                id: userProfile.id,
                email: userProfile.email,
                name: userProfile.name,
                mobile: userProfile.mobile,
                role: userProfile.role,
                isActive: userProfile?.status as boolean,
                address: userAddress ? {
                    street: userAddress.street,
                    city: userAddress.city,
                    state: userAddress.state,
                    zip: userAddress.zip
                } : null
            }

            // Emit profile viewed event
            EventService.emitAuditTrail(
                'profile_viewed',
                'profile',
                userId as string,
                userId as string,
                {
                    context: this.getContextInfo(req),
                    email: userProfile.email,
                    hasAddress: !!userAddress
                },
                EventService.createContextFromRequest(req)
            );

            Logging.info(`Profile fetched for ${this.getContextInfo(req)}: ${userProfile.email}`);
            responseResult.sendResponse({ 
                res,
                data: userProfileData,
                message: "User profile fetched successfully",
                
                });
        }catch(error){
            Logging.error(`Error fetching profile for ${this.getContextInfo(req)}: ${error}`)
            errorResponse.sendError({
                res,
                message: "Error fetching user profile",
            });
        }
        
    };

    private updateProfile = async (req: Request, res: Response, next: NextFunction) => {
        this.validateTenantContext(req);
        
        const userId = req.userId; // Access the userId from the request object
        const { name, email, mobile } = req.body;
        const { address, city, state, postalCode } = req.body;

        try {
            let user;
            const addressRepository = this.getAddressRepository(req);

            if (req.isLandlord) {
                // Landlord request - use main database
                user = await this.userService.findById(userId as string);
            } else {
                // Tenant request - use tenant database
                user = await this.userService.findById(req.tenantConnection!, userId as string);
            }

            if (!user) {
                return errorResponse.sendError({
                    res,
                    message: "User not found",
                });
            }

            if (email && email !== user.email) {
                let existingUser;
                 // Use the new email uniqueness validation
                const emailValidation = await validateEmailUniqueness(email, req.tenantConnection, req.isLandlord);
                
                if (!emailValidation.isValid) {
                    return errorResponse.sendError({ 
                        res, 
                        statusCode: 409, 
                        message: "Validation failed",
                        details: [`email: ${emailValidation.message}`]
                    });
                }
            }

            if(mobile && mobile !== user.mobile){
                let existingUser;
                if (req.isLandlord) {
                    existingUser = await this.userService.findByMobile(mobile);
                } else {
                    existingUser = await this.userService.findByMobile(req.tenantConnection!, mobile);
                }

                if (existingUser) {
                    return errorResponse.sendError({
                        res,
                        statusCode: 409,
                        message: "Validation failed",
                        details: ["mobile: Mobile number is already in use"],
                    });
                }
            }


            let updatedUser;
            if (req.isLandlord) {
                updatedUser = await this.userService.update(userId as string, {
                    name,
                    email,
                    mobile,
                });
            } else {
                updatedUser = await this.userService.update(req.tenantConnection!, userId as string, {
                    name,
                    email,
                    mobile,
                });
            }
            
            const userAddress = await addressRepository.findByUserId(userId as string);
            if (userAddress) {
                // Update existing address
                await addressRepository.update(userAddress?._id as string, {
                    street: address,
                    city,
                    state,
                    zip: postalCode,
                });
            } else {
                // Create new address
                const newAddress: Partial<IAddress> = {
                    userId: user as IUser,
                    street: address,
                    city,
                    state,
                    zip: postalCode,
                };
                await addressRepository.create(newAddress);
            }

            const updatedAddress = await addressRepository.findByUserId(userId as string);

            const responseData = {
                email: updatedUser?.email,
                name: updatedUser?.name,
                mobile: updatedUser?.mobile,
                address: updatedAddress ? {
                    street: updatedAddress.street,
                    city: updatedAddress.city,
                    state: updatedAddress.state,
                    zip: updatedAddress.zip
                } : null
            };

            // Emit comprehensive profile update events
            EventService.emitUserUpdated({
                userId: userId as string,
                previousData: {
                    email: user.email,
                    name: user.name,
                    mobile: user.mobile
                },
                newData: {
                    email: updatedUser?.email,
                    name: updatedUser?.name,
                    mobile: updatedUser?.mobile
                },
                updatedFields: Object.keys(req.body).filter(key => 
                    ['email', 'name', 'mobile'].includes(key) && req.body[key] !== undefined
                ),
                updatedBy: userId as string,
                tenantId: req.tenant?._id || req.tenant?.id
            }, EventService.createContextFromRequest(req));

            // Emit audit trail
            EventService.emitAuditTrail(
                'profile_updated',
                'profile',
                userId as string,
                userId as string,
                {
                    context: this.getContextInfo(req),
                    previousData: {
                        email: user.email,
                        name: user.name,
                        mobile: user.mobile
                    },
                    newData: responseData,
                    updatedFields: Object.keys(req.body),
                    addressUpdated: !!(address || city || state || postalCode)
                },
                EventService.createContextFromRequest(req)
            );

            // Emit CRUD operation event
            EventService.emitCrudOperation({
                operation: 'update',
                resource: 'profile',
                resourceId: userId as string,
                userId: userId as string,
                tenantId: req.tenant?._id || req.tenant?.id,
                data: responseData,
                previousData: DataSanitizer.sanitizeData<IUser>(user, ['password'])
            }, EventService.createContextFromRequest(req));

            // Handle address events
            if (userAddress && (address || city || state || postalCode)) {
                // Address updated
                EventService.emitAddressUpdated({
                    addressId: userAddress._id as string,
                    userId: userId as string,
                    previousData: {
                        street: userAddress.street,
                        city: userAddress.city,
                        state: userAddress.state,
                        zip: userAddress.zip
                    },
                    newData: {
                        street: address,
                        city,
                        state,
                        zip: postalCode
                    },
                    tenantId: req.tenant?._id || req.tenant?.id
                }, EventService.createContextFromRequest(req));
            } else if (!userAddress && (address || city || state || postalCode)) {
                // Address created
                EventService.emitAddressCreated({
                    addressId: updatedAddress?._id as string,
                    userId: userId as string,
                    street: address,
                    city,
                    state,
                    zip: postalCode,
                    tenantId: req.tenant?._id || req.tenant?.id
                }, EventService.createContextFromRequest(req));
            }

            responseResult.sendResponse({
                res,
                data: responseData,
                message: "User profile updated successfully",
            });
        }catch (error) {
            Logging.error(`Error updating profile for ${this.getContextInfo(req)}: ${error}`)
            errorResponse.sendError({
                res,
                message: "Error updating user profile",
            });
        }
            
    }

    private updatePassword = async (req: Request, res: Response, next : NextFunction) => {
        this.validateTenantContext(req);
        
        const userId = req.userId; // Access the userId from the request object
        const { currentPassword, newPassword } = req.body;

        try {
            let user;

            if (req.isLandlord) {
                // Landlord request - use main database
                user = await this.userService.findById(userId as string);
            } else {
                // Tenant request - use tenant database
                user = await this.userService.findById(req.tenantConnection!, userId as string);
            }

            if (!user || !user.password) {
                return errorResponse.sendError({
                    res,
                    message: "User not found",
                });
            }

            const isPasswordValid = await comparePassword(currentPassword, user.password);
            if (!isPasswordValid) {
                return errorResponse.sendError({
                    res,
                    statusCode: 406,
                    message: "Current password is incorrect",
                });
            }

            const hashedNewPassword = await hashPassword(newPassword);
            
            if (req.isLandlord) {
                await this.userService.update(userId as string, { password: hashedNewPassword });
            } else {
                await this.userService.update(req.tenantConnection!, userId as string, { password: hashedNewPassword });
            }

            // Emit password update events
            EventService.emitUserPasswordReset({
                userId: userId as string,
                email: user.email,
                resetBy: userId as string,
                tenantId: req.tenant?._id || req.tenant?.id,
                resetMethod: 'self'
            }, EventService.createContextFromRequest(req));

            // Emit audit trail
            EventService.emitAuditTrail(
                'profile_password_updated',
                'profile',
                userId as string,
                userId as string,
                {
                    context: this.getContextInfo(req),
                    email: user.email,
                    method: 'self_service'
                },
                EventService.createContextFromRequest(req)
            );

            // Emit CRUD operation event
            EventService.emitCrudOperation({
                operation: 'update',
                resource: 'profile_password',
                resourceId: userId as string,
                userId: userId as string,
                tenantId: req.tenant?._id || req.tenant?.id,
                data: { passwordUpdated: true }
            }, EventService.createContextFromRequest(req));

            Logging.info(`Password updated for ${this.getContextInfo(req)}: ${user.email}`);
            responseResult.sendResponse({
                res,
                data: null,
                statusCode: 200,
                message: "Password updated successfully",
            });
        } catch (error) {
            Logging.error(`Error updating password for ${this.getContextInfo(req)}: ${error}`)
            errorResponse.sendError({
                res,
                message: "Error updating password",
            });
        }
    }

    // Cache management methods
    private clearCache = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { patterns } = (req.body || {}) as { patterns?: string[] | string };
            let totalCleared = 0;
            
            if (!patterns) {
                totalCleared = await CacheService.clear();
            } else if (Array.isArray(patterns)) {
                for (const p of patterns) {
                    totalCleared += await CacheService.clear(p);
                }
            } else {
                totalCleared = await CacheService.clear(patterns);
            }

            // Emit cache clear event
            EventService.emitAuditTrail(
                'profile_cache_cleared',
                'cache',
                'profile_cache',
                req.userId || 'system',
                {
                    context: this.getContextInfo(req),
                    patterns: patterns || 'all',
                    clearedCount: totalCleared
                },
                EventService.createContextFromRequest(req)
            );

            return responseResult.sendResponse({
                res,
                data: { cleared: totalCleared },
                message: `Profile cache cleared (${totalCleared} keys)`,
                statusCode: 200
            });
        } catch (error) {
            return errorResponse.sendError({
                res,
                message: 'Failed to clear profile cache',
                statusCode: 500,
                details: error
            });
        }
    }

    private getCacheStats = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const stats = CacheService.getStats();
            const health = await CacheService.healthCheck();
            
            return responseResult.sendResponse({
                res,
                data: { stats, health },
                message: 'Profile cache stats retrieved',
                statusCode: 200
            });
        } catch (error) {
            return errorResponse.sendError({
                res,
                message: 'Failed to get profile cache stats',
                statusCode: 500,
                details: error
            });
        }
    }

    private getProfileStats = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Get basic profile statistics
            const context = this.getContextInfo(req);
            
            // For now, return basic stats - you can expand this based on your needs
            const stats = {
                context,
                isLandlord: req.isLandlord,
                tenantSubdomain: req.tenant?.subdomain || null,
                userId: req.userId,
                timestamp: new Date().toISOString(),
                cacheEnabled: true,
                eventsEnabled: true
            };

            // Emit stats access event
            EventService.emitAuditTrail(
                'profile_stats_accessed',
                'profile_stats',
                'system',
                req.userId || 'anonymous',
                {
                    context,
                    stats
                },
                EventService.createContextFromRequest(req)
            );

            return responseResult.sendResponse({
                res,
                data: stats,
                message: 'Profile statistics retrieved successfully',
                statusCode: 200
            });
        } catch (error) {
            return errorResponse.sendError({
                res,
                message: 'Failed to get profile statistics',
                statusCode: 500,
                details: error
            });
        }
    }
}

export default new ProfileController().router;