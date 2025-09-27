import { Request, Response, NextFunction } from 'express';
import { Controller } from './controller';
import { responseResult } from '../utils/response';
import { errorResponse } from '../utils/errorResponse';
import UserService from '../services/user.service';
import { IUser } from '../models/user.model';
import Logging from '../libraries/logging.library';
import ValidateMiddleware from '../middlewares/validate';
import { 
    createUserSchema, 
    updateUserSchema, 
    getUserSchema, 
    deleteUserSchema,
    validateEmailUniqueness 
} from '../validators/user.validator';
import { 
    ValidationError, 
    ConflictError, 
    NotFoundError, 
    DatabaseError,
    CreationFailedError,
    UpdateFailedError,
    DeletionFailedError,
    isValidationError,
    isDatabaseError,
    isCreationFailedError,
    isUpdateFailedError,
    isDeletionFailedError
} from '../errors/CustomErrors';
import CacheMiddleware from '../middlewares/cache.middleware';
import CacheService from '../services/cache.service';
import EventEmissionMiddleware from '../middlewares/eventEmission.middleware';
import EventService from '../events/EventService';
import { UserCreatedPayload } from '../events/types/EventPayloads';
import { rateLimitConfig } from '../config';
import { DateUtils } from '../utils/dateUtils';
import DataSanitizer from '../utils/sanitizeData';
import { hashPassword } from '../utils/passwords';
import addressRepository from '../repositories/address.repository';

import { IAddress } from '../models/address.model';

import { SubdomainExtractor, DomainUtils } from '../utils/domain';
import TenantService from '../services/tenant.service';
class UserController extends Controller {
    private userService: UserService;
    private tenantService: TenantService;
    constructor() {
        super();
        this.userService = UserService.getInstance();
        this.tenantService = TenantService.getInstance();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        const validateMiddleware = ValidateMiddleware.getInstance();
        
        // Create user with rate limit and cache invalidation
        this.router.post("/", 
            validateMiddleware.validate(createUserSchema),
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000,
                maxRequests: rateLimitConfig.post,
                keyGenerator: (req) => `user:create:${req.ip}:${req.isLandlord ? 'landlord' : req.tenant?.subdomain}`
            }),
            CacheMiddleware.invalidate((req) => {
                const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                const patterns = [
                    `users:list:${context}:*`,
                    `users:stats:${context}:*`
                ];
                
                // If storeId is available in request, also invalidate store staff cache
                if (req.storeId && req.tenant) {
                    patterns.push(
                        `staff:candidates:list:${context}:${req.storeId}:*`,
                        `staff:list:${context}:${req.storeId}:*`
                    );
                }
                
                // If tenant operation, also invalidate landlord cache keys that use tenantId
                if (!req.isLandlord && req.tenant?._id) {
                    patterns.push(
                        `users:list:${req.tenant._id}:*`,
                        `users:stats:${req.tenant._id}:*`,
                        `tenant:${req.tenant._id}:summary`
                    );
                    
                    // Also invalidate landlord store staff cache if storeId available
                    if (req.tenant) {
                        patterns.push(
                            `staff:candidates:list:${req.tenant._id}*`,
                            `staff:list:${req.tenant._id}*`
                        );
                    }
                }
                
                return patterns;
            }),
            EventEmissionMiddleware.forCreate('user'),
            this.asyncHandler(this.createUser.bind(this)),
        );
        
        // List users with rate limiting and caching
        this.router.get("/", 
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.get,
                keyGenerator: (req) => `user:list:${req.ip}:${req.isLandlord ? 'landlord' : req.tenant?.subdomain}`
            }),
            CacheMiddleware.cache({
                ttl: 300,
                prefix: 'users',
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                    const queryStr = JSON.stringify(req.query || {});
                    return `list:${context}:${Buffer.from(queryStr).toString('base64')}`;
                },
                condition: (req) => {
                    const email = req.query?.email?.toString();
                    return !email || !email.includes('@admin');
                }
            }),
            EventEmissionMiddleware.forRead('user_list', {
                extractResourceId: (req) => req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown'),
                skipCrud: true
            }),
            this.asyncHandler(this.getUsers)
        );
        
        // Get user detail with caching
        this.router.get("/:id", 
            validateMiddleware.validate(getUserSchema),
            CacheMiddleware.cache({
                ttl: 600,
                prefix: 'user',
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                    return `detail:${context}:${req.params.id}`;
                }
            }),
            EventEmissionMiddleware.forRead('user'),
            this.asyncHandler(this.getUserById)
        );
        
        // Update user with rate limit and cache invalidation
        this.router.put("/:id", 
            validateMiddleware.validate(updateUserSchema),
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.put,
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                    return `user:${req.params.id}:update:${req.ip}:${context}`;
                }
            }),
            CacheMiddleware.invalidate((req) => {
                const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                const patterns = [
                    `user:detail:${context}:${req.params.id}`,
                    `users:list:${context}:*`,
                    `users:stats:${context}:*`
                ];
                
                // If tenant operation, also invalidate landlord cache keys that use tenantId
                if (!req.isLandlord && req.tenant?._id) {
                    patterns.push(
                        `user:detail:${req.tenant._id}:${req.params.id}`,
                        `users:list:${req.tenant._id}:*`,
                        `users:stats:${req.tenant._id}:*`
                    );
                }
                
                return patterns;
            }),
            EventEmissionMiddleware.forUpdate('user'),
            this.asyncHandler(this.updateUser)
        );
        
        // Delete user with rate limit and cache invalidation
        this.router.delete("/:id", 
            validateMiddleware.validate(deleteUserSchema),
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000,
                maxRequests: rateLimitConfig.delete,
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                    return `user:delete:${req.ip}:${context}`;
                }
            }),
            CacheMiddleware.invalidate((req) => {
                const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                const patterns = [
                    `user:detail:${context}:${req.params.id}`,
                    `users:list:${context}:*`,
                    `users:stats:${context}:*`
                ];
                
                // If storeId is available in request, also invalidate store staff cache
                if (req.storeId && req.tenant) {
                    patterns.push(
                        `staff:candidates:list:${context}:${req.storeId}:*`,
                        `staff:list:${context}:${req.storeId}:*`
                    );
                }
                
                // If tenant operation, also invalidate landlord cache keys that use tenantId
                if (!req.isLandlord && req.tenant?._id) {
                    patterns.push(
                        `user:detail:${req.tenant._id}:${req.params.id}`,
                        `users:list:${req.tenant._id}:*`,
                        `users:stats:${req.tenant._id}:*`,
                        `tenant:${req.tenant._id}:summary`
                    );
                    
                    // Also invalidate landlord store staff cache if storeId available
                    if (req.tenant) {
                        patterns.push(
                            `staff:candidates:list:${req.tenant._id}*`,
                            `staff:list:${req.tenant._id}:*`
                        );
                    }
                }
                
                return patterns;
            }),
            EventEmissionMiddleware.forDelete('user'),
            this.asyncHandler(this.deleteUser)
        );
        
        // Deactivate user with rate limit and cache invalidation
        this.router.patch("/:id/deactivate", 
            validateMiddleware.validate(getUserSchema),
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.patch,
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                    return `user:${req.params.id}:deactivate:${req.ip}:${context}`;
                }
            }),
            CacheMiddleware.invalidate((req) => {
                const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                const patterns = [
                    `user:detail:${context}:${req.params.id}`,
                    `users:list:${context}:*`,
                    `users:stats:${context}:*`
                ];
                
                // If tenant operation, also invalidate landlord cache keys that use tenantId
                if (!req.isLandlord && req.tenant?._id) {
                    patterns.push(
                        `user:detail:${req.tenant._id}:${req.params.id}`,
                        `users:list:${req.tenant._id}:*`,
                        `users:stats:${req.tenant._id}:*`
                    );
                }
                
                return patterns;
            }),
            EventEmissionMiddleware.createEventMiddleware({
                resource: 'user',
                operation: 'update',
                customEventName: 'user.deactivated'
            }),
            this.asyncHandler(this.deactivateUser)
        );
        
        // Search users with rate limiting
        this.router.get("/search/:term", 
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.get,
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                    return `user:search:${req.ip}:${context}`;
                }
            }),
            EventEmissionMiddleware.forRead('user_search', {
                extractResourceId: (req) => req.params.term,
                skipCrud: true
            }),
            this.asyncHandler(this.searchUsers)
        );
        
        // Get user statistics with caching
        this.router.get("/stats/count", 
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.get,
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                    return `user:stats:${req.ip}:${context}`;
                }
            }),
            CacheMiddleware.cache({
                ttl: 300,
                prefix: 'users',
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                    return `stats:${context}`;
                }
            }),
            EventEmissionMiddleware.forRead('user_stats', {
                extractResourceId: (req) => req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown'),
                skipCrud: true
            }),
            this.asyncHandler(this.getUserStats)
        );
        
        // Cache management endpoints
        this.router.post("/cache/clear", 
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000,
                maxRequests: 10,
                keyGenerator: (req) => `user:cache:clear:${req.ip}`
            }),
            EventEmissionMiddleware.createEventMiddleware({
                resource: 'cache',
                operation: 'delete',
                customEventName: 'user.cache.cleared'
            }),
            this.asyncHandler(this.clearCache)
        );
        
        this.router.get("/cache/stats", 
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: 50,
                keyGenerator: (req) => `user:cache:stats:${req.ip}`
            }),
            EventEmissionMiddleware.forRead('cache_stats', {
                extractResourceId: () => 'user_cache',
                skipCrud: true
            }),
            this.asyncHandler(this.getCacheStats)
        );

        this.router.patch("/:id/reset-password",
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.patch,
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                    return `user:reset-password:${req.ip}:${context}`;
                }
            }),
            EventEmissionMiddleware.createEventMiddleware({
                resource: 'user',
                operation: 'update',
                customEventName: 'user.password.reset'
            }),
            this.asyncHandler(this.passwordReset.bind(this))
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
    private getContextInfo(req: Request): { tenantId: string; subdomain: string } | string {
        if (req.isLandlord) {
            return 'landlord (main database)';
        }
        return {
            tenantId: req.tenant?._id as string,
            subdomain: req.tenant?.subdomain as string
        }
    }

    /**
     * Create a new user in tenant's database or main database (landlord)
     */
    private createUser = async (req: Request, res: Response, next: NextFunction) => {
        
        const userData = req.body;
       
        


        try {

            this.validateTenantContext(req);
            let tenant;
            if(!req.isLandlord){
             tenant = await this.tenantService.getTenantBySubdomain(req.tenant?.subdomain as string);
            }
            

           
            // create a connection to the tenant's database
            const existingUser = await this.userService.findByEmail(req.tenantConnection!,userData.email);
            if (existingUser) {
                throw new ConflictError("Email is already in use", "email", userData.email);
                
            }

            const existingUserByMobile = await this.userService.findByMobile(req.tenantConnection!, userData.mobile);
            if (existingUserByMobile) {
                throw new ConflictError("Mobile number is already in use", "mobile", userData.mobile);
                
            }
            const hashedPassword = await hashPassword(userData.password);
            const user = await this.userService.create(req.tenantConnection!, { ...userData, password: hashedPassword });
            if (!user) {
                throw new CreationFailedError("Failed to create user", "user", "Failed to create user");
                
            }

            // Emit user created event with comprehensive data including tenant info
            const userCreatedEventPayload: UserCreatedPayload = {
                userId: user._id as string,
                email: user.email,
                name: user.name,
                mobile: user.mobile,
                role: user.role,
                createdBy: req.userId || 'admin' // Use actual user ID if available
            };

            if (!req.isLandlord) {
                userCreatedEventPayload.tenantId = tenant?._id as string;
                userCreatedEventPayload.tenantName = tenant?.name;
                userCreatedEventPayload.tenantSubdomain = tenant?.subdomain;
            }
            
            EventService.emitUserCreated(userCreatedEventPayload, EventService.createContextFromRequest(req));

            // Sanitize the user data to remove sensitive fields
            const sanitizedUser = DataSanitizer.sanitizeData<IUser>(user, ['password']);
            

// ...
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
    };

    /**
     * Get users with pagination (landlord or tenant)
     */
    private getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const { page, limit, name, email, mobile, role, status, createdAtFrom, createdAtTo, sortBy, sortOrder, sortField, sortDirection } = req.query;
        
        try {
            this.validateTenantContext(req);
            
            
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

            // Use the enhanced getUsersWithPagination method
            const result = await this.userService.getUsersWithPagination(req.tenantConnection!, {
                page: Number(page) || 1,
                limit: Number(limit) || 10,
                filter,
                sort
            });

            if (!result) {
                throw new NotFoundError("No users found", "users", req.isLandlord ? 'landlord' : req.tenant?._id as string);
            }

            // Sanitize the user data to remove sensitive fields
            const sanitizedUsers = DataSanitizer.sanitizeData<IUser[]>(result.items, ['password']);

            // Emit audit event for user list access
            EventService.emitAuditTrail(
                'user_list_accessed',
                'user_list',
                req.isLandlord ? 'landlord' : req.tenant?._id as string,
                'system', // or req.userId if available
                {
                    totalUsers: (result as any).total || (result as any).totalCount || result.items?.length || 0,
                    page: Number(page) || 1,
                    limit: Number(limit) || 10,
                    filters: filter,
                    sort: sort,
                    context: req.isLandlord ? 'landlord' : 'tenant'
                },
                EventService.createContextFromRequest(req)
            );

            responseResult.sendResponse({
                res,
                data: {
                    ...result,
                    items: sanitizedUsers
                },
                message: 'Users retrieved successfully',
                statusCode: 200
            });
        } catch (error) {
            // Enhanced error handling for user listing
            if (isValidationError(error)) {
                errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 400,
                    details: error.details
                });
                return;
            }

            if (error instanceof NotFoundError) {
                errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 404,
                    details: {
                        resource: error.resource,
                        resourceId: error.resourceId
                    }
                });
                return;
            }

            if (isDatabaseError(error)) {
                Logging.error("Database error in user listing:", error);
                errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
                return;
            }

            // Log unexpected errors
            Logging.error("Unexpected error in user listing:", error);
            errorResponse.sendError({
                res,
                message: "Failed to fetch users",
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    };

    /**
     * Get user by ID (landlord or tenant)
     */
    private getUserById = async (req: Request, res: Response, next: NextFunction) => {
        
    const userId = req.params.id;
    
        
        if (!userId ) {
            throw new NotFoundError("User not found", "user", userId);
        }

    try {
        this.validateTenantContext(req);
        

       
        
        // Use the corrected findById method with proper populate options
        const user = await this.userService.findById(req.tenantConnection!, userId);
        Logging.info("Fetched user:", user);
        const userAddress = new addressRepository(req.tenantConnection!);
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
    };

    /**
     * Update user (landlord or tenant)
     */
    private updateUser = async (req: Request, res: Response, next: NextFunction) => {
        const userId = req.params.id;
        const updateData = req.body;
         if (!userId) {
             throw new ValidationError("User ID and Tenant ID are required", [
                !userId ? "userId: User ID is required" : "",
               
            ].filter(Boolean));
        }
        try {
            this.validateTenantContext(req);
            
            const { id } = req.params;
            const updateData = req.body;
            // Check for email uniqueness (exclude current user)
            if (updateData.email) {
                const existingUser = await this.userService.findByEmail(req.tenantConnection!, updateData.email);
                
                if (existingUser && String(existingUser._id) !== userId) {

                    throw new ConflictError("Email is already in use", "email", updateData.email);
                }
            }
             // Check for mobile uniqueness (exclude current user)
            if (updateData.mobile) {
                const existingUserByMobile = await this.userService.findByMobile(req.tenantConnection!, updateData.mobile);
               
                if (existingUserByMobile && String(existingUserByMobile._id) !== userId) {

                    throw new ConflictError("Mobile number is already in use", "mobile", updateData.mobile);
                }
            }
            

            

            let user: IUser | null;

            if (req.isLandlord) {
                user = await this.userService.update(id, updateData);
            } else {
                user = await this.userService.update(req.tenantConnection!, id, updateData);
            }

            if (!user) {
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
                userId: id,
                previousData: {
                    email: user.email,
                    name: user.name,
                    mobile: user.mobile
                },
                newData: updateData,
                updatedFields: Object.keys(updateData).filter(key => 
                    ['email', 'name', 'mobile'].includes(key) && updateData[key] !== undefined
                ),
                updatedBy: 'admin', // or req.userId if available
                tenantId: req.isLandlord ? 'landlord' : req.tenant?._id as string
            }, EventService.createContextFromRequest(req));
            const userAddress = new addressRepository(req.tenantConnection!);
            const address = await userAddress.findByUserId(userId);

            if (address && (updateData.address || updateData.city || updateData.state || updateData.postalCode)) {
                                        // Update existing address and emit event
                                        const previousAddressData = {
                                            street: address.street,
                                            city: address.city,
                                            state: address.state,
                                            zip: address.zip
                                        };

                                        await userAddress.update( address._id as string, {
                                            street: updateData.address,
                                            city: updateData.city,
                                            state : updateData.state,
                                            zip: updateData.postalCode,
                                        });
                                        
                                        // Emit address updated event
                                        EventService.emitAddressUpdated({
                                            addressId: address._id as string,
                                            userId: user._id as string,
                                            previousData: previousAddressData,
                                            newData: {
                                                street: updateData.address,
                                                city: updateData.city,
                                                state: updateData.state,
                                                zip: updateData.postalCode
                                            },
                                            
                                        }, EventService.createContextFromRequest(req));
                                    } else if (!address && (updateData.address || updateData.city || updateData.state || updateData.postalCode)) {
                                        // Create new address
                                        const newAddress: Partial<IAddress> = {
                                            userId: user._id,
                                            street: updateData.address,
                                            city: updateData.city,
                                            state: updateData.state,
                                            zip: updateData.postalCode,
                                        };
                                        const createdAddress = await userAddress.create(newAddress);
                                        
                                        // Emit address created event
                                        EventService.emitAddressCreated({
                                            addressId: createdAddress._id as string,
                                            userId: user._id as string,
                                            street: updateData.address,
                                            city: updateData.city,
                                            state: updateData.state,
                                            zip: updateData.postalCode,
                                           
                                        }, EventService.createContextFromRequest(req));
                                    }
            // Sanitize the user data to remove sensitive fields
            const sanitizedUser = DataSanitizer.sanitizeData<IUser>(user, ['password']);
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
    };

    /**
     * Delete user (landlord or tenant)
     */
    private deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            this.validateTenantContext(req);
            
            const { id } = req.params;
            
            // Get user data before deletion for event emission
            let userToDelete: IUser | null;
            if (req.isLandlord) {
                userToDelete = await this.userService.findById(id);
            } else {
                userToDelete = await this.userService.findById(req.tenantConnection!, id);
            }

            if (!userToDelete) {
                throw new NotFoundError('User not found', 'user', id);
            }

            let user: IUser | null;
            if (req.isLandlord) {
                user = await this.userService.delete(id);
            } else {
                user = await this.userService.delete(req.tenantConnection!, id);
            }

            if (!user) {
                throw new DeletionFailedError(
                    "Failed to delete user", 
                    "user", 
                    id, 
                    "User not found or deletion operation failed"
                );
            }

            // Emit user deleted event
            EventService.emitUserDeleted({
                userId: id,
                email: userToDelete.email,
                name: userToDelete.name,
                deletedBy: 'admin', // or req.userId if available
                tenantId: req.isLandlord ? 'landlord' : req.tenant?._id as string,
                softDelete: false
            }, EventService.createContextFromRequest(req));

            responseResult.sendResponse({
                res,
                data: null,
                message: 'User deleted successfully',
                statusCode: 200
            });

            Logging.info(`User deleted in ${this.getContextInfo(req)}: ${userToDelete.email}`);
        } catch (error) {
            if (error instanceof NotFoundError) {
                errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 404,
                    details: {
                        resource: error.resource,
                        resourceId: error.resourceId
                    }
                });
                return;
            }

            if (isDeletionFailedError(error)) {
                Logging.warn("User deletion failed:", error);
                errorResponse.sendError({
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
                return;
            }

            if (isDatabaseError(error)) {
                Logging.error("Database error in user deletion:", error);
                errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
                return;
            }

            // Log unexpected errors
            Logging.error("Unexpected error in user deletion:", error);
            errorResponse.sendError({
                res,
                message: 'Failed to delete user',
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    };

    /**
     * Deactivate user
     */
    private deactivateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            this.validateTenantContext(req);
            
            const { id } = req.params;
            const user = await this.userService.deactivate(req.tenantConnection!, id);

            if (!user) {
                errorResponse.sendError({
                    res,
                    message: 'User not found',
                    statusCode: 404
                });
                return;
            }

            // Remove password from response
            const userResponse = { ...user.toObject(), password: undefined };

            // Emit user deactivated event
            EventService.emitUserUpdated({
                userId: id,
                previousData: {
                    status: true, // assuming user was active before
                    isActive: true
                },
                newData: {
                    status: false,
                    isActive: false
                },
                updatedFields: ['status', 'isActive'],
                updatedBy: 'admin', // or req.userId if available
                tenantId: req.isLandlord ? 'landlord' : req.tenant?._id as string
            }, EventService.createContextFromRequest(req));

            responseResult.sendResponse({
                res,
                data: userResponse,
                message: 'User deactivated successfully',
                statusCode: 200
            });

            Logging.info(`User deactivated in ${this.getContextInfo(req)}: ${user.email}`);
        } catch (error) {
            if (error instanceof NotFoundError) {
                errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 404,
                    details: {
                        resource: error.resource,
                        resourceId: error.resourceId
                    }
                });
                return;
            }
            
            if (isUpdateFailedError(error)) {
                Logging.warn("User deactivation failed:", error);
                errorResponse.sendError({
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
                return;
            }
            
            if (isDatabaseError(error)) {
                Logging.error("Database error in user deactivation:", error);
                errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
                return;
            }
            
            // Log unexpected errors
            Logging.error("Unexpected error in user deactivation:", error);
            errorResponse.sendError({
                res,
                message: 'Failed to deactivate user',
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    };

    /**
     * Search users
     */
    private searchUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            this.validateTenantContext(req);
            
            const { term } = req.params;

            if (!term || term.trim().length < 2) {
                errorResponse.sendError({
                    res,
                    message: 'Search term must be at least 2 characters long',
                    statusCode: 400
                });
                return;
            }

            const users = await this.userService.search(req.tenantConnection!, term);

            // Remove passwords from response
            const usersResponse = users.map(user => ({ ...user.toObject(), password: undefined }));

            // Emit search event
            EventService.emitAuditTrail(
                'user_search_performed',
                'user_search',
                req.isLandlord ? 'landlord' : req.tenant?._id as string,
                'system', // or req.userId if available
                {
                    searchTerm: term,
                    resultsCount: users.length,
                    context: req.isLandlord ? 'landlord' : 'tenant'
                },
                EventService.createContextFromRequest(req)
            );

            responseResult.sendResponse({
                res,
                data: usersResponse,
                message: 'Users search completed',
                statusCode: 200
            });
        } catch (error) {
            if (isValidationError(error)) {
                errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 400,
                    details: error.details
                });
                return;
            }
            
            if (isDatabaseError(error)) {
                Logging.error("Database error in user search:", error);
                errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
                return;
            }
            
            // Log unexpected errors
            Logging.error("Unexpected error in user search:", error);
            errorResponse.sendError({
                res,
                message: 'Failed to search users',
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    };

    /**
     * Get user statistics (landlord or tenant)
     */
    private getUserStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            this.validateTenantContext(req);
            
            let activeUsersCount: number;

            if (req.isLandlord) {
                // For landlord, we could count all users or implement specific logic
                activeUsersCount = await this.userService.getActiveCount(req.tenantConnection!);
            } else {
                activeUsersCount = await this.userService.getActiveCount(req.tenantConnection!);
            }

            // Emit stats viewed event
            EventService.emitAuditTrail(
                'user_stats_accessed',
                'user_stats',
                req.isLandlord ? 'landlord' : req.tenant?._id as string,
                'system', // or req.userId if available
                {
                    activeUsers: activeUsersCount,
                    context: req.isLandlord ? 'landlord' : 'tenant'
                },
                EventService.createContextFromRequest(req)
            );

            responseResult.sendResponse({
                res,
                data: {
                    activeUsers: activeUsersCount,
                    context: req.isLandlord ? 'landlord' : 'tenant',
                    tenant: req.tenant?.name || 'Main Database',
                    subdomain: req.subdomain || 'landlord'
                },
                message: 'User statistics retrieved successfully',
                statusCode: 200
            });
        } catch (error) {
            if (isDatabaseError(error)) {
                Logging.error("Database error in user statistics:", error);
                errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
                return;
            }
            
            // Log unexpected errors
            Logging.error("Unexpected error in user statistics:", error);
            errorResponse.sendError({
                res,
                message: 'Failed to retrieve user statistics',
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    };

    /**
     * Clear user-related cache
     */
    private clearCache = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { patterns } = (req.body || {}) as { patterns?: string[] | string };
            let totalCleared = 0;
            
            if (!patterns) {
                // Clear all user-related cache
                const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                const userPatterns = [
                    `users:list:${context}:*`,
                    `user:detail:${context}:*`,
                    `users:stats:${context}:*`
                ];
                
                for (const pattern of userPatterns) {
                    totalCleared += await CacheService.clear(pattern);
                }
            } else if (Array.isArray(patterns)) {
                for (const p of patterns) {
                    totalCleared += await CacheService.clear(p);
                }
            } else {
                totalCleared = await CacheService.clear(patterns);
            }

            // Emit cache cleared event
            EventService.emitAuditTrail(
                'user_cache_cleared',
                'cache',
                req.isLandlord ? 'landlord' : req.tenant?._id as string,
                'admin', // or req.userId if available
                {
                    clearedKeys: totalCleared,
                    patterns: patterns || 'all_user_cache',
                    context: req.isLandlord ? 'landlord' : 'tenant'
                },
                EventService.createContextFromRequest(req)
            );

            responseResult.sendResponse({
                res,
                data: { 
                    cleared: totalCleared,
                    context: req.isLandlord ? 'landlord' : 'tenant'
                },
                message: `User cache cleared (${totalCleared} keys)`,
                statusCode: 200
            });
        } catch (error) {
            Logging.error("Error clearing user cache:", error);
            errorResponse.sendError({
                res,
                message: 'Failed to clear user cache',
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    };

    /**
     * Get user cache statistics
     */
    private getCacheStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const stats = CacheService.getStats();
            const health = await CacheService.healthCheck();
            const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;

            // Emit cache stats viewed event
            EventService.emitAuditTrail(
                'user_cache_stats_accessed',
                'cache_stats',
                req.isLandlord ? 'landlord' : req.tenant?._id as string,
                'admin', // or req.userId if available
                {
                    context: req.isLandlord ? 'landlord' : 'tenant',
                    cacheHealth: health.status
                },
                EventService.createContextFromRequest(req)
            );

            responseResult.sendResponse({
                res,
                data: { 
                    stats, 
                    health,
                    context: context,
                    scope: 'user_operations'
                },
                message: 'User cache statistics retrieved successfully',
                statusCode: 200
            });
        } catch (error) {
            Logging.error("Error getting user cache stats:", error);
            errorResponse.sendError({
                res,
                message: 'Failed to get user cache statistics',
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    };


    private passwordReset = async (req: Request, res: Response, next: NextFunction) => {
        
        const userId = req.params.id;
        const { newPassword } = req.body;

        if ( !userId || !newPassword) {
             if (!newPassword || !userId) {
             throw new ValidationError("User ID and New Password are required", [
                !userId ? "userId: User ID is required" : "",
                !newPassword ? "newPassword: New Password is required" : ""
            ].filter(Boolean));
        }
        }

        try {
           
             this.validateTenantContext(req);
            // Create a connection to the tenant's database
            let tenant;
            if(!req.isLandlord){
                tenant = await this.tenantService.getTenantBySubdomain(req.tenant?.subdomain as string);
               }
            
            // Get user data for event emission
            const userForReset = await this.userService.findById(req.tenantConnection!, userId);
            if (!userForReset) {
                throw new NotFoundError("User not found", "user", userId);
            }
            
            const hashedPassword = await hashPassword(newPassword);
            const updatedUser = await this.userService.update(req.tenantConnection!, userId, { password: hashedPassword });
            if (!updatedUser) {
                throw new UpdateFailedError(
                    "Failed to update password", 
                    "user", 
                    userForReset?._id as string, 
                    "User not found or no changes made", 
                    ["password"]
                );
            }

            // Emit password reset event
           EventService.emitUserPasswordReset({
                        name:userForReset.name,
                           userId: userForReset?._id as string,
                           email: userForReset.email,
                           resetBy: 'admin' ,// Use actual user ID if available
                           tenantId: tenant?._id as string,
                           resetMethod: 'admin',
                           subdomain: tenant?.subdomain as string,
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

export default new UserController().router;
