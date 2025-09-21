import e, { Request,Response, NextFunction } from "express";
import { Controller } from "./controller";
import { responseResult } from "../utils/response";
import { errorResponse } from "../utils/errorResponse";
import  TenantService  from "../services/tenant.service";
import {TenantConnectionService} from "../services/tenantConnection.service";
import Logging from "../libraries/logging.library";
import { DateUtils } from "../utils/dateUtils";
import UserService from "../services/user.service";
import DataSanitizer from "../utils/sanitizeData";
import { IUser } from "../models/user.model";
import { hashPassword } from "../utils/passwords";
import EventService from "../events/EventService";
import addressRepository from "../repositories/address.repository";
import { IAddress } from "../models/address.model";
import EventEmissionMiddleware from "../middlewares/eventEmission.middleware";
import CacheMiddleware from "../middlewares/cache.middleware";
import CacheService from "../services/cache.service";
import { changeUserPasswordForTenantSchema, createUserForTenantSchema, deleteUserForTenantSchema, getUserForTenantSchema, getUsersForTenantSchema, updateUserForTenantSchema } from "../validators/user.validator";
import ValidateMiddleware from "../middlewares/validate";
import { 
    ConflictError, 
    CreationFailedError, 
    NotFoundError, 
    UpdateFailedError, 
    ValidationError, 
    DeletionFailedError,
    DatabaseError,
    isValidationError,
    isCreationFailedError,
    isUpdateFailedError,
    isDeletionFailedError,
    isDatabaseError
} from "../errors/CustomErrors";
import { rateLimitConfig } from "../config";


class TenantUserController extends Controller{
     private tenantService: TenantService;
     private connectionService: TenantConnectionService;
     private userService: UserService;
  
    constructor() {
        super()
        this.initializeRoutes();
        this.tenantService = TenantService.getInstance();
        this.connectionService = TenantConnectionService.getInstance();
        this.userService = UserService.getInstance();
    }

    /**
     * Resolve tenant context and set it in request for consistent cache keys
     */
    private async resolveTenantContext(req: Request, tenantId: string): Promise<void> {
        if (!req.tenant) {
            const tenant = await this.tenantService.findById(tenantId);
            if (tenant) {
                req.tenant = tenant;
                req.subdomain = tenant.subdomain;
                
            }
        }
    }

    // Cache admin handlers
    private async clearCache(req: Request, res: Response, next: NextFunction) {
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

            return responseResult.sendResponse({
                res,
                data: { cleared: totalCleared },
                message: `Cache cleared (${totalCleared} keys)` ,
                statusCode: 200
            });
        } catch (error) {
            return errorResponse.sendError({
                res,
                message: 'Failed to clear cache',
                statusCode: 500,
                details: error
            });
        }
    }

    private async getCacheStats(req: Request, res: Response, next: NextFunction) {
        try {
            const stats = CacheService.getStats();
            const health = await CacheService.healthCheck();
            return responseResult.sendResponse({
                res,
                data: { stats, health },
                message: 'Cache stats',
                statusCode: 200
            });
        } catch (error) {
            return errorResponse.sendError({
                res,
                message: 'Failed to get cache stats',
                statusCode: 500,
                details: error
            });
        }
    }
    private initializeRoutes() {
        // List users with rate limiting and caching
        this.router.get(
            '/:tenantId/users',
            ValidateMiddleware.getInstance().validate(getUsersForTenantSchema),
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.get,
                keyGenerator: (req) => `tenant:${req.params.tenantId}:users:list:${req.ip}`
            }),
            CacheMiddleware.cache({
                ttl: 300,
                prefix: 'users',
                keyGenerator: (req) => {
                    const { tenantId } = req.params as any;
                    // Get tenant subdomain for consistent cache keys
                    const tenant = req.tenant || { subdomain: tenantId };
                    const context = tenant.subdomain || tenantId;
                    const queryStr = JSON.stringify(req.query || {});
                    return `list:${context}:${Buffer.from(queryStr).toString('base64')}`;
                },
                condition: (req) => {
                    const email = req.query?.email?.toString();
                    return !email || !email.includes('@admin');
                }
            }),
            EventEmissionMiddleware.forRead('user_list', {
                extractResourceId: (req) => req.params.tenantId,
                skipCrud: true
            }),
            this.asyncHandler(this.getUsers.bind(this))
        );

        // Create user with rate limit and cache invalidation
        this.router.post(
            '/:tenantId/users',
            ValidateMiddleware.getInstance().validate(createUserForTenantSchema),
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000,
                maxRequests: rateLimitConfig.post,
                keyGenerator: (req) => `tenant:${req.params.tenantId}:users:create:${req.ip}`
            }),
            CacheMiddleware.invalidate((req) => {
                const { tenantId } = req.params;
                // Get tenant subdomain for consistent cache invalidation
                const tenant = req.tenant || { subdomain: tenantId };
                const context = tenant.subdomain || tenantId;
                return [
                    // Invalidate with subdomain context (for tenant access)
                    `users:list:${context}:*`,
                    `users:stats:${context}:*`,
                    // Also invalidate with tenantId context (for landlord access)
                    `users:list:${tenantId}:*`,
                    `users:stats:${tenantId}:*`,
                    `tenant:${tenantId}:summary`
                ];
            }),
            EventEmissionMiddleware.forCreate('user'),
            this.asyncHandler(this.create.bind(this))
        );

        // Get user detail with caching
        this.router.get(
            '/:tenantId/users/:userId',
            ValidateMiddleware.getInstance().validate(getUserForTenantSchema),
           
            CacheMiddleware.cache({
                ttl: 600,
                prefix: 'user',
                keyGenerator: (req) => {
                    const { tenantId, userId } = req.params;
                    // Get tenant subdomain for consistent cache keys
                    const tenant = req.tenant || { subdomain: tenantId };
                    const context = tenant.subdomain || tenantId;
                    return `detail:${context}:${userId}`;
                },
            }),
            EventEmissionMiddleware.forRead('user'),
            this.asyncHandler(this.getUser.bind(this))
        );

        // Update user with rate limit and cache invalidation
        this.router.put(
            '/:tenantId/users/:userId',
            ValidateMiddleware.getInstance().validate(updateUserForTenantSchema.partial({ body: true })),
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.patch,
                keyGenerator: (req) => `tenant:${req.params.tenantId}:user:${req.params.userId}:update:${req.ip}`
            }),
            CacheMiddleware.invalidate((req) => {
                const { tenantId, userId } = req.params;
                // Get tenant subdomain for consistent cache invalidation
                const tenant = req.tenant || { subdomain: tenantId };
                const context = tenant.subdomain || tenantId;
                return [
                    // Invalidate with subdomain context (for tenant access)
                    `user:detail:${context}:${userId}`,
                    `users:list:${context}:*`,
                    `users:stats:${context}:*`,
                    // Also invalidate with tenantId context (for landlord access)
                    `user:detail:${tenantId}:${userId}`,
                    `users:list:${tenantId}:*`,
                    `users:stats:${tenantId}:*`
                ];
            }),
            EventEmissionMiddleware.forUpdate('user'),
            this.asyncHandler(this.update.bind(this))
        );

        // Delete user with rate limit and cache invalidation
        this.router.delete(
            '/:tenantId/users/:userId',
            ValidateMiddleware.getInstance().validate(deleteUserForTenantSchema),
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000,
                maxRequests: rateLimitConfig.delete,
                keyGenerator: (req) => `tenant:${req.params.tenantId}:users:delete:${req.ip}`
            }),
            CacheMiddleware.invalidate((req) => {
                const { tenantId, userId } = req.params;
                // Get tenant subdomain for consistent cache invalidation
                const tenant = req.tenant || { subdomain: tenantId };
                const context = tenant.subdomain || tenantId;
                return [
                    // Invalidate with subdomain context (for tenant access)
                    `user:detail:${context}:${userId}`,
                    `users:list:${context}:*`,
                    `users:stats:${context}:*`,
                    // Also invalidate with tenantId context (for landlord access)
                    `user:detail:${tenantId}:${userId}`,
                    `users:list:${tenantId}:*`,
                    `users:stats:${tenantId}:*`,
                    `tenant:${tenantId}:summary`
                ];
            }),
            EventEmissionMiddleware.forDelete('user'),
            this.asyncHandler(this.delete.bind(this))
        );

        // Reset password with rate limit
        this.router.patch(
            '/:tenantId/users/:userId/reset-password',
            ValidateMiddleware.getInstance().validate(changeUserPasswordForTenantSchema),
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000,
                maxRequests: rateLimitConfig.patch,
                keyGenerator: (req) => `tenant:${req.params.tenantId}:user:${req.params.userId}:password:${req.ip}`
            }),
            EventEmissionMiddleware.createEventMiddleware({
                resource: 'user',
                operation: 'update',
                customEventName: 'user.password.reset'
            }),
            this.asyncHandler(this.passwordReset.bind(this))
        );

        // Cache management endpoints
        this.router.post(
            '/:tenantId/cache/clear',
            this.asyncHandler(this.clearCache.bind(this))
        );

        this.router.get(
            '/:tenantId/cache/stats',
            this.asyncHandler(this.getCacheStats.bind(this))
        );
    }

    private getUsers = async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.params.tenantId;
        const { page, limit, name, email, mobile, role, status, createdAtFrom, createdAtTo, sortBy, sortOrder, sortField, sortDirection } = req.query;
        if (!tenantId) {
           return errorResponse.sendError({
                res,
                message: "Tenant ID is required",
                statusCode: 400
            });

        }

        try {
            // Resolve tenant context for consistent cache keys
            await this.resolveTenantContext(req, tenantId);

            const tenant = await this.tenantService.findById(tenantId);
            if (!tenant) {
                throw new NotFoundError("Tenant not found", "tenant", tenantId);
            }

            // Build filter object based on query parameters
            const filter: any = {};
            
            if (name) {
                filter.name = { $regex: name, $options: 'i' }; // Case-insensitive search
            }

            if (email) {
                filter.email = { $regex: email, $options: 'i' }; // Case-insensitive search
            }

            if (mobile) {
                filter.mobile = { $regex: mobile, $options: 'i' }; // Case-insensitive search
            }

            if (role) {
                filter.role = role;
            }

            if (status !== undefined) {
                filter.status = status === 'true'; // Convert to boolean
            }
            // Date range filtering with improved timezone handling
            if (createdAtFrom || createdAtTo) {
                const timezoneOffset = DateUtils.getTimezoneOffset(req);
                const dateFilter = DateUtils.getDateRangeFilter(
                    createdAtFrom as string,
                    createdAtTo as string,
                    timezoneOffset
                );
                
                if (dateFilter) {
                    filter.createdAt = dateFilter;
                    
                    // Log the date filtering for debugging
                    if (dateFilter.$gte) {
                        Logging.info(DateUtils.formatDateLog(
                            dateFilter.$gte, 
                            'Date filter FROM', 
                            createdAtFrom as string, 
                            timezoneOffset
                        ));
                    }
                    
                    if (dateFilter.$lte) {
                        Logging.info(DateUtils.formatDateLog(
                            dateFilter.$lte, 
                            'Date filter TO', 
                            createdAtTo as string, 
                            timezoneOffset
                        ));
                    }
                }
            }

            // Build sort object - support both old and new parameter names
            const sort: any = {};
            
            // Priority: sortField/sortDirection > sortBy/sortOrder
            const fieldName = (sortField as string) || (sortBy as string);
            const direction = (sortDirection as string) || (sortOrder as string);
            
            if (fieldName) {
                // Support both 'asc'/'desc' and 'ascending'/'descending'
                const order = direction === 'asc' || direction === 'ascending' ? 1 : -1;
                sort[fieldName] = order;
            } else {
                sort.createdAt = -1; // Default sort by creation date descending
            }

            // create a connection to the tenant's database

            const connection = await this.connectionService.getTenantConnection(tenant.subdomain);
             const result = await this.userService.getUsersWithPagination(connection.connection, {
                page: Number(page) || 1,
                limit: Number(limit) || 10,
                filter,
                sort
            });

            
            
            if (!result) {

                throw new NotFoundError("No users found", "tenant", tenantId);

            }
            // Sanitize the tenant data to remove sensitive fields
            const sanitizedTenants = DataSanitizer.sanitizeData<IUser[]>(result.items, ['password']);

            // Emit audit event for user list access
            EventService.emitAuditTrail(
                'user_list_accessed',
                'user_list',
                tenant._id as string,
                'system', // or req.userId if available
                {
                    totalUsers: (result as any).total || (result as any).totalCount || result.items?.length || 0,
                    page: Number(page) || 1,
                    limit: Number(limit) || 10,
                    filters: filter
                },
                EventService.createContextFromRequest(req)
            );

           return responseResult.sendResponse({
                res,
                data: {
                    ...result,
                    items: sanitizedTenants
                },
                message: "Users retrieved successfully",
                statusCode: 200
            });
            // Sanitize the tenant data to remove sensitive fields
           

            
        } catch (error) {
            // Enhanced error handling for user listing
            if (isValidationError(error)) {
                return errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 400,
                    details: error.details
                });
            }

            if (error instanceof NotFoundError) {
                return errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 404,
                    details: {
                        resource: error.resource,
                        resourceId: error.resourceId
                    }
                });
            }

            if (isDatabaseError(error)) {
                Logging.error("Database error in user listing:", error);
                return errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
            }

            // Log unexpected errors
            Logging.error("Unexpected error in user listing:", error);
            return errorResponse.sendError({
                res,
                message: "Failed to fetch users",
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }

    }


    private create = async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.params.tenantId;
        const userData = req.body;
        if (!tenantId) {
           return errorResponse.sendError({
                res,
                message: "Tenant ID is required",
                statusCode: 400
            });

        }

        try {
            // Resolve tenant context for consistent cache keys
            await this.resolveTenantContext(req, tenantId);

            const tenant = await this.tenantService.findById(tenantId);
            if (!tenant) {
                   
                throw new NotFoundError("Tenant not found", "tenant", tenantId);
            }
            const connection = await this.connectionService.getTenantConnection(tenant.subdomain);
            // create a connection to the tenant's database
            const existingUser = await this.userService.findByEmail(connection.connection, userData.email);
            if (existingUser) {
                throw new ConflictError("Email is already in use", "email", userData.email);
                
            }

            const existingUserByMobile = await this.userService.findByMobile(connection.connection, userData.mobile);
            if (existingUserByMobile) {
                throw new ConflictError("Mobile number is already in use", "mobile", userData.mobile);
                
            }
            const hashedPassword = await hashPassword(userData.password);
            const user = await this.userService.create(connection.connection, { ...userData, password: hashedPassword });
            if (!user) {
                throw new CreationFailedError("Failed to create user", "user", "Failed to create user");
                
            }

            // Debug logging to see what tenant info we have
            Logging.info('TenantUserController creating user with tenant info:', {
                tenantId: tenantId,
                tenantName: tenant.name,
                tenantSubdomain: tenant.subdomain,
                userEmail: user.email
            });

            // Emit user created event with comprehensive data including tenant info
            EventService.emitUserCreated({
                userId: user._id as string,
                email: user.email,
                name: user.name,
                mobile: user.mobile,
                role: user.role,
                tenantId: tenantId as string,
                tenantName: tenant.name,
                tenantSubdomain: tenant.subdomain,
                createdBy: req.userId || 'admin' // Use actual user ID if available
            }, EventService.createContextFromRequest(req));

            // Sanitize the user data to remove sensitive fields
            const sanitizedUser = DataSanitizer.sanitizeData<IUser>(user, ['password']);
            

              return responseResult.sendResponse({  
                res,
                data: sanitizedUser,
                message: "User created successfully",
                statusCode: 201
            });
        } catch (error) {
            // Enhanced error handling for user creation
            if (isValidationError(error)) {
                return errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 400,
                    details: error.details
                });
            }

            if (error instanceof NotFoundError) {
                return errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 404,
                    details: {
                        resource: error.resource,
                        resourceId: error.resourceId
                    }
                });
            }

            if (error instanceof ConflictError) {
                return errorResponse.sendError({
                    res,
                    message: "Validation failed",
                    statusCode: 409,
                    details: [`${error.conflictField}: ${error.message}`]
                });
            }

            if (isCreationFailedError(error)) {
                Logging.warn("User creation failed:", error);
                return errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 422,
                    details: {
                        resource: error.resource,
                        reason: error.reason,
                        failedFields: error.failedFields
                    }
                });
            }

            if (isDatabaseError(error)) {
                Logging.error("Database error in user creation:", error);
                return errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
            }

            // Log unexpected errors
            Logging.error("Unexpected error in user creation:", error);
            return errorResponse.sendError({
                res,
                message: "Failed to create user",
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    }


    private getUser = async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.params.tenantId;
    const userId = req.params.userId;
    
        if (!tenantId ) {
            throw new NotFoundError("Tenant not found", "tenant", tenantId);
        }

        if (!userId ) {
            throw new NotFoundError("User not found", "user", userId);
        }

    try {
        // Resolve tenant context for consistent cache keys
        await this.resolveTenantContext(req, tenantId);
        
        const tenant = await this.tenantService.findById(tenantId);
        if (!tenant) {
             throw new NotFoundError("User not found", "tenant", tenantId);
        }

        // Create a connection to the tenant's database
        const connection = await this.connectionService.getTenantConnection(tenant.subdomain);
        
        // Use the corrected findById method with proper populate options
        const user = await this.userService.findById(connection.connection, userId);
         const userAddress = new addressRepository(connection.connection);
        const address = await userAddress.findByUserId(userId);
        if (!user) {
            return errorResponse.sendError({
                res,
                message: "User not found",
                statusCode: 404
            });
        }

        // Emit user viewed event
        EventService.emitUserViewed(
            userId,
            'admin', // or req.userId if available
            EventService.createContextFromRequest(req)
        );

        // Sanitize the user data to remove sensitive fields
        const sanitizedUser = DataSanitizer.sanitizeData<IUser>(user, ['password']);
        
        return responseResult.sendResponse({
            res,
            data: {...sanitizedUser, address: address ? {
                street: address.street,
                city: address.city,
                state: address.state,
                zip: address.zip
            } : null},
            message: "User retrieved successfully",
            statusCode: 200
        });
    } catch (error) {
        // Enhanced error handling for user retrieval
        if (isValidationError(error)) {
            return errorResponse.sendError({
                res,
                message: error.message,
                statusCode: 400,
                details: error.details
            });
        }

        if (error instanceof NotFoundError) {
            return errorResponse.sendError({
                res,
                message: error.message,
                statusCode: 404,
                details: {
                    resource: error.resource,
                    resourceId: error.resourceId
                }
            });
        }

        if (isDatabaseError(error)) {
            Logging.error("Database error in user retrieval:", error);
            return errorResponse.sendError({
                res,
                message: "Database operation failed",
                statusCode: 500
            });
        }

        // Log unexpected errors
        Logging.error("Unexpected error in user retrieval:", error);
        return errorResponse.sendError({
            res,
            message: "Failed to fetch user",
            statusCode: 500,
            details: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }   
    }

    private update = async (req: Request, res: Response, next: NextFunction) => {
        // Implementation for updating a user
        const tenantId = req.params.tenantId;
        const userId = req.params.userId;
        const updateData = req.body;

        if (!tenantId || !userId) {
             throw new ValidationError("User ID and Tenant ID are required", [
                !userId ? "userId: User ID is required" : "",
                !tenantId ? "tenantId: Tenant ID is required" : ""
            ].filter(Boolean));
        }

        try {
            // Resolve tenant context for consistent cache keys
            await this.resolveTenantContext(req, tenantId);
            
            const tenant = await this.tenantService.findById(tenantId);
            if (!tenant) {
                return errorResponse.sendError({
                    res,
                    message: "Tenant not found",
                    statusCode: 404
                });
            }

            // Create a connection to the tenant's database
            const connection = await this.connectionService.getTenantConnection(tenant.subdomain);
            // Check for email uniqueness (exclude current user)
            if (updateData.email) {
                const existingUser = await this.userService.findByEmail(connection.connection, updateData.email);
                
                if (existingUser && String(existingUser._id) !== userId) {

                    throw new ConflictError("Email is already in use", "email", updateData.email);
                }
            }
            // Check for mobile uniqueness (exclude current user)
            if (updateData.mobile) {
                const existingUserByMobile = await this.userService.findByMobile(connection.connection, updateData.mobile);
               
                if (existingUserByMobile && String(existingUserByMobile._id) !== userId) {

                    throw new ConflictError("Mobile number is already in use", "mobile", updateData.mobile);
                }
            }

        
          

            // Get previous user data for event emission
            const previousUser = await this.userService.findById(connection.connection, userId);
            
            const updatedUser = await this.userService.update(connection.connection, userId, {email: updateData.email, name: updateData.name, mobile: updateData.mobile});
            if (!updatedUser) {
                throw new UpdateFailedError(
                    "Failed to update user", 
                    "user", 
                    userId, 
                    "User not found or no changes made", 
                    ["email", "name", "mobile"]
                );
            }

            // Emit user updated event
            EventService.emitUserUpdated({
                userId: userId,
                previousData: {
                    email: previousUser?.email,
                    name: previousUser?.name,
                    mobile: previousUser?.mobile
                },
                newData: {
                    email: updateData.email,
                    name: updateData.name,
                    mobile: updateData.mobile
                },
                updatedFields: Object.keys(updateData).filter(key => 
                    ['email', 'name', 'mobile'].includes(key) && updateData[key] !== undefined
                ),
                updatedBy: 'admin', // or req.userId if available
                tenantId: tenantId
            }, EventService.createContextFromRequest(req));

            const userAddress = new addressRepository(connection.connection);
            const address = await userAddress.findByUserId(userId);
            
            if (address && (updateData.address || updateData.city || updateData.state || updateData.postalCode)) {
                            // Update existing address and emit event
                            const previousAddressData = {
                                street: address.street,
                                city: address.city,
                                state: address.state,
                                zip: address.zip
                            };
                            
                            await userAddress.update(address._id as string, {
                                street: updateData.address,
                                city: updateData.city,
                                state : updateData.state,
                                zip: updateData.postalCode,
                            });
                            
                            // Emit address updated event
                            EventService.emitAddressUpdated({
                                addressId: address._id as string,
                                userId: updatedUser._id as string,
                                previousData: previousAddressData,
                                newData: {
                                    street: updateData.address,
                                    city: updateData.city,
                                    state: updateData.state,
                                    zip: updateData.postalCode
                                },
                                tenantId: tenantId
                            }, EventService.createContextFromRequest(req));
                        } else if (!address && (updateData.address || updateData.city || updateData.state || updateData.postalCode)) {
                            // Create new address
                            const newAddress: Partial<IAddress> = {
                                userId: updatedUser._id,
                                street: updateData.address,
                                city: updateData.city,
                                state: updateData.state,
                                zip: updateData.postalCode,
                            };
                            const createdAddress = await userAddress.create(newAddress);
                            
                            // Emit address created event
                            EventService.emitAddressCreated({
                                addressId: createdAddress._id as string,
                                userId: updatedUser._id as string,
                                street: updateData.address,
                                city: updateData.city,
                                state: updateData.state,
                                zip: updateData.postalCode,
                                tenantId: tenantId
                            }, EventService.createContextFromRequest(req));
                        }
                
            
            // Sanitize the user data to remove sensitive fields
            const sanitizedUser = DataSanitizer.sanitizeData<IUser>(updatedUser, ['password']);
            const updatedAddress = await userAddress.findByUserId(userId as string);
            return responseResult.sendResponse({
                res,
                data: {...sanitizedUser, address: updatedAddress ? {
                    street: updatedAddress.street,
                    city: updatedAddress.city,
                    state: updatedAddress.state,
                    zip: updatedAddress.zip
                } : null},
                message: "User updated successfully",
                statusCode: 200
            });
        } catch (error) {
            // Enhanced error handling for user update
            if (isValidationError(error)) {
                return errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 400,
                    details: error.details
                });
            }

            if (error instanceof ConflictError) {
                return errorResponse.sendError({
                    res,
                    message: "Validation failed",
                    statusCode: 409,
                    details: [`${error.conflictField}: ${error.message}`]
                });
            }

            if (error instanceof NotFoundError) {
                return errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 404,
                    details: {
                        resource: error.resource,
                        resourceId: error.resourceId
                    }
                });
            }

            if (isUpdateFailedError(error)) {
                Logging.warn("User update failed:", error);
                return errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 422,
                    details: {
                        resource: error.resource,
                        resourceId: error.resourceId,
                        reason: error.reason,
                        failedFields: error.failedFields
                    }
                });
            }

            if (isDatabaseError(error)) {
                Logging.error("Database error in user update:", error);
                return errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
            }

            // Log unexpected errors
            Logging.error("Unexpected error in user update:", error);
            return errorResponse.sendError({
                res,
                message: "Failed to update user",
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }

           
    }

    private delete = async (req: Request, res: Response, next: NextFunction) => {
        // Implementation for deleting a user
        const tenantId = req.params.tenantId;
        const userId = req.params.userId;

        if (!tenantId || !userId) {
            return errorResponse.sendError({
                res,
                message: "Tenant ID and User ID are required",
                statusCode: 400
            });
        }

        try {
            // Resolve tenant context for consistent cache keys
            await this.resolveTenantContext(req, tenantId);
            
            const tenant = await this.tenantService.findById(tenantId);
            if (!tenant) {
                return errorResponse.sendError({
                    res,
                    message: "Tenant not found",
                    statusCode: 404
                });
            }

            // Create a connection to the tenant's database
            const connection = await this.connectionService.getTenantConnection(tenant.subdomain);
            
            // Get user data before deletion for event emission
            const userToDelete = await this.userService.findById(connection.connection, userId);
            if (!userToDelete) {
                return errorResponse.sendError({
                    res,
                    message: "User not found",
                    statusCode: 404
                });
            }
            
            const userAddress = new addressRepository(connection.connection);
            await userAddress.deleteByUserId(userId);
            const deletedUser = await this.userService.delete(connection.connection, userId);
            if (!deletedUser) {
                throw new DeletionFailedError(
                    "Failed to delete user", 
                    "user", 
                    userId, 
                    "User not found or deletion operation failed"
                );
            }

            // Emit user deleted event
            EventService.emitUserDeleted({
                userId: userId,
                email: userToDelete.email,
                name: userToDelete.name,
                deletedBy: 'admin', // or req.userId if available
                tenantId: tenantId,
                softDelete: false
            }, EventService.createContextFromRequest(req));

            // Emit address deleted event if address existed
            EventService.emitAddressDeleted(
                'address_for_user_' + userId,
                userId,
                EventService.createContextFromRequest(req)
            );

            return responseResult.sendResponse({
                res,
                message: "User deleted successfully",
                statusCode: 200
            });
        } catch (error) {
            // Enhanced error handling for user deletion
            if (isValidationError(error)) {
                return errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 400,
                    details: error.details
                });
            }

            if (error instanceof NotFoundError) {
                return errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 404,
                    details: {
                        resource: error.resource,
                        resourceId: error.resourceId
                    }
                });
            }

            if (isDeletionFailedError(error)) {
                Logging.warn("User deletion failed:", error);
                return errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 422,
                    details: {
                        resource: error.resource,
                        resourceId: error.resourceId,
                        reason: error.reason,
                        dependencies: error.dependencies
                    }
                });
            }

            if (isDatabaseError(error)) {
                Logging.error("Database error in user deletion:", error);
                return errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
            }

            // Log unexpected errors
            Logging.error("Unexpected error in user deletion:", error);
            return errorResponse.sendError({
                res,
                message: "Failed to delete user",
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    }

    private passwordReset = async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.params.tenantId;
        const userId = req.params.userId;
        const { newPassword } = req.body;

        if (!tenantId || !userId || !newPassword) {
            return errorResponse.sendError({
                res,
                message: "Tenant ID, User ID, and new password are required",
                statusCode: 400
            });
        }

        try {
            // Resolve tenant context for consistent cache keys
            await this.resolveTenantContext(req, tenantId);
            
            const tenant = await this.tenantService.findById(tenantId);
            if (!tenant) {
                return errorResponse.sendError({
                    res,
                    message: "Tenant not found",
                    statusCode: 404
                });
            }

            // Create a connection to the tenant's database
            const connection = await this.connectionService.getTenantConnection(tenant.subdomain);
            
            // Get user data for event emission
            const userForReset = await this.userService.findById(connection.connection, userId);
            if (!userForReset) {
                return errorResponse.sendError({
                    res,
                    message: "User not found",
                    statusCode: 404
                });
            }
            
            const hashedPassword = await hashPassword(newPassword);
            const updatedUser = await this.userService.update(connection.connection, userId, { password: hashedPassword });
            if (!updatedUser) {
                return errorResponse.sendError({
                    res,
                    message: "User not found or no changes made",
                    statusCode: 404
                });
            }

            // Emit password reset event
            EventService.emitUserPasswordReset({
                userId: userId,
                email: userForReset.email,
                resetBy: 'admin', // or req.userId if available
                tenantId: tenantId,
                resetMethod: 'admin'
            }, EventService.createContextFromRequest(req));

            // Sanitize the user data to remove sensitive fields
            const sanitizedUser = DataSanitizer.sanitizeData<IUser>(updatedUser, ['password']);
            return responseResult.sendResponse({
                res,
                data: sanitizedUser,
                message: "Password updated successfully",
                statusCode: 200
            });
        } catch (error) {
            // Enhanced error handling for password reset
            if (isValidationError(error)) {
                return errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 400,
                    details: error.details
                });
            }

            if (error instanceof NotFoundError) {
                return errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 404,
                    details: {
                        resource: error.resource,
                        resourceId: error.resourceId
                    }
                });
            }

            if (isUpdateFailedError(error)) {
                Logging.warn("Password reset failed:", error);
                return errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 422,
                    details: {
                        resource: error.resource,
                        resourceId: error.resourceId,
                        reason: error.reason,
                        failedFields: error.failedFields
                    }
                });
            }

            if (isDatabaseError(error)) {
                Logging.error("Database error in password reset:", error);
                return errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
            }

            // Log unexpected errors
            Logging.error("Unexpected error in password reset:", error);
            return errorResponse.sendError({
                res,
                message: "Failed to update password",
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    }

}



export default new TenantUserController().router;