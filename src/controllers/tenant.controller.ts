import { Request, Response, NextFunction } from "express";
import { Controller } from "./controller";
import { responseResult } from "../utils/response";
import { errorResponse } from "../utils/errorResponse";
import TenantService from "../services/tenant.service";
import { ITenant } from "../models/tenant.model";

import Logging from "../libraries/logging.library";
import { DateUtils } from "../utils/dateUtils";
import ValidateMiddleware from "../middlewares/validate";
import { tenantCreateSchema , getTenantsSchema, getTenantSchema, updateTenantSchema, deleteTenantSchema} from "../validators/tenant.validator";
import DataSanitizer from "../utils/sanitizeData";
import EventService from "../events/EventService";
import CacheMiddleware from "../middlewares/cache.middleware";
import CacheService from "../services/cache.service";
import EventEmissionMiddleware from "../middlewares/eventEmission.middleware";
import ErrorHandler from "../errors/ErrorHandler";
import { 
    ValidationError, 
    DatabaseError, 
    NotFoundError, 
    ConflictError,
    isDatabaseError,
    isValidationError, 
    CreationFailedError,
    UpdateFailedError,
    DeletionFailedError,
    isCreationFailedError,
    isUpdateFailedError,
    isDeletionFailedError
} from "../errors/CustomErrors";
import { rateLimitConfig } from "../config";

class TenantController extends Controller{
    private tenantService: TenantService;
    constructor() {
        super()
        this.initializeRoutes();
        this.tenantService = TenantService.getInstance();
    }

    private initializeRoutes() {
        // Create tenant with rate limiting and cache invalidation
        this.router.post(
            "/create", 
            ValidateMiddleware.getInstance().validate(tenantCreateSchema),
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                maxRequests: rateLimitConfig.post,
                keyGenerator: (req) => `tenant:create:${req.ip}`
            }),
            CacheMiddleware.invalidate(() => [
                'tenants:list:*',
                'tenants:stats:*',
                'tenant:count'
            ]),
            EventEmissionMiddleware.forCreate('tenant'),
            this.asyncHandler(this.create)
        );

        // List tenants with caching and rate limiting
        this.router.get(
            "/", 
            ValidateMiddleware.getInstance().validate(getTenantsSchema),
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                maxRequests: rateLimitConfig.get,
                keyGenerator: (req) => `tenant:list:${req.ip}:user:${req.userId}`
            }),
            CacheMiddleware.cache({
                ttl: 300, // 5 minutes
                prefix: 'tenants',
                keyGenerator: (req) => {
                    const queryStr = JSON.stringify(req.query || {});
                    return `list:${Buffer.from(queryStr).toString('base64')}`;
                }
            }),
            EventEmissionMiddleware.forRead('tenant_list', {
                skipCrud: true
            }),
            this.asyncHandler(this.index)
        );

        // Get tenant detail with caching
        this.router.get(
            "/:id", 
            ValidateMiddleware.getInstance().validate(getTenantSchema),
            CacheMiddleware.cache({
                ttl: 600, // 10 minutes
                prefix: 'tenant',
                keyGenerator: (req) => `detail:${req.params.id}`
            }),
            EventEmissionMiddleware.forRead('tenant'),
            this.asyncHandler(this.getTenant)
        );

        // Update tenant with rate limiting and cache invalidation
        this.router.put(
            "/:id", 
            ValidateMiddleware.getInstance().validate(updateTenantSchema),
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                maxRequests: rateLimitConfig.put,
                keyGenerator: (req) => `tenant:${req.params.id}:update:${req.ip}`
            }),
            CacheMiddleware.invalidate((req) => [
                `tenant:detail:${req.params.id}`,
                'tenants:list:*',
                'tenants:stats:*'
            ]),
            EventEmissionMiddleware.forUpdate('tenant'),
            this.asyncHandler(this.update)
        );

        // Delete tenant with rate limiting and cache invalidation
        this.router.delete(
            "/:id", 
            ValidateMiddleware.getInstance().validate(deleteTenantSchema),
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000, // 1 hour
                maxRequests: rateLimitConfig.delete,
                keyGenerator: (req) => `tenant:${req.params.id}:delete:${req.ip}`
            }),
            CacheMiddleware.invalidate((req) => [
                `tenant:detail:${req.params.id}`,
                'tenants:list:*',
                'tenants:stats:*',
                'tenant:count'
            ]),
            EventEmissionMiddleware.forDelete('tenant'),
            this.asyncHandler(this.delete)
        );

        // Cache management endpoints
        this.router.post(
            "/cache/clear",
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000, // 1 hour
                maxRequests: rateLimitConfig.post,
                keyGenerator: (req) => `tenant:cache:clear:${req.ip}`
            }),
            this.asyncHandler(this.clearCache)
        );

        this.router.get(
            "/cache/stats",
            CacheMiddleware.rateLimit({
                windowMs: 60 * 1000, // 1 minute
                maxRequests: rateLimitConfig.get,
                keyGenerator: (req) => `tenant:cache:stats:${req.ip}`
            }),
            this.asyncHandler(this.getCacheStats)
        );

        // Tenant statistics endpoint
        this.router.get(
            "/stats",
            CacheMiddleware.cache({
                ttl: 300, // 5 minutes
                prefix: 'tenants',
                keyGenerator: () => 'stats:summary'
            }),
            this.asyncHandler(this.getTenantStats)
        );
    }

   

    private create = async (req: Request , res: Response, next: NextFunction)=>  {
        const userId = req.userId; // Assuming req.user is populated by authentication middleware
        const {name, subdomain} = req.body;
        
        try {
            // Validation checks
            if(!name || !subdomain){
                throw new ValidationError("Name and Subdomain are required", [
                    !name ? "name: Name is required" : "",
                    !subdomain ? "subdomain: Subdomain is required" : ""
                ].filter(Boolean));
            }

            // Check for existing name
            const isNameTaken = await this.tenantService.checkTenantExists(name);
            if(isNameTaken){
                throw new ConflictError("Name is already in use", "name", name);
            }

            // Check for subdomain availability
            const isAvailable = await this.tenantService.checkSubdomainAvailability(subdomain);
            if(!isAvailable){
                throw new ConflictError("Subdomain is already in use", "subdomain", subdomain);
            }

            // Create tenant
            const newTenant: Partial<ITenant> = {
                name,
                subdomain,
                createdBy: userId,
            }
            const createdTenant = await this.tenantService.registerTenant(newTenant);
            if(!createdTenant){
                throw new CreationFailedError(
                    "Failed to create tenant", 
                    "tenant", 
                    "Database operation failed", 
                    ["name", "subdomain"]
                );
            }
            const sanitizedTenant = DataSanitizer.sanitizeData<ITenant>(createdTenant, ['databasePassword']);
            // Emit comprehensive tenant creation events
            EventService.emitTenantCreated({
                tenantId: createdTenant._id as string,
                name: createdTenant.name,
                subdomain: createdTenant.subdomain,
                databaseName: createdTenant.databaseName,
                databaseUser: createdTenant.databaseUser,
                createdBy: userId!
            }, EventService.createContextFromRequest(req));

            // Emit audit trail
            EventService.emitAuditTrail(
                'tenant_created',
                'tenant',
                createdTenant._id as string,
                userId!,
                {
                    name: createdTenant.name,
                    subdomain: createdTenant.subdomain,
                    databaseName: createdTenant.databaseName
                },
                EventService.createContextFromRequest(req)
            );

            // Emit CRUD operation event
            EventService.emitCrudOperation({
                operation: 'create',
                resource: 'tenant',
                resourceId: createdTenant._id as string,
                userId: userId!,
                data: sanitizedTenant
            }, EventService.createContextFromRequest(req));

            return responseResult.sendResponse({
                res,
                data: sanitizedTenant,
                message: "Tenant created successfully",
                statusCode: 201
            });
        } catch (error) {
            // Enhanced error handling with specific error types
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

            if (isCreationFailedError(error)) {
                Logging.warn("Tenant creation failed:", error);
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
                Logging.error("Database error in tenant creation:", error);
                return errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
            }

            // Log unexpected errors
            Logging.error("Unexpected error in tenant creation:", error);
            return errorResponse.sendError({
                res,
                message: "Internal Server Error",
                statusCode: 500
            });
        }
    }

    private index = async (req: Request , res: Response, next: NextFunction)=>  {

        const { 
            page, 
            limit, 
            name, 
            subdomain, 
            createdAtFrom, 
            createdAtTo, 
            sortBy, 
            sortOrder, 
            sortField, 
            sortDirection,
            populate,
            includeRelations = 'true'
        } = req.query;
        
        try {
            // Build filter object based on query parameters
            const filter: any = {};
            
            if (name) {
                filter.name = { $regex: name, $options: 'i' }; // Case-insensitive search
            }
            
            if (subdomain) {
                filter.subdomain = { $regex: subdomain, $options: 'i' }; // Case-insensitive search
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

            // Build populate options
            let populateOptions: any = undefined;
            
            if (includeRelations === 'true' && !populate) {
                // Default population
                populateOptions = [
                    { path: 'createdBy', select: 'name email' },
                    
                ];
            } else if (populate && includeRelations === 'true') {
                // Custom populate from query parameter (JSON string expected)
                try {
                    populateOptions = JSON.parse(populate as string);
                } catch (parseError) {
                    // If parsing fails, use populate as comma-separated string
                    populateOptions = (populate as string).split(',').map(field => field.trim());
                }
            }

            const result = await this.tenantService.getTenantsWithPagination({
                page: Number(page) || 1,
                limit: Number(limit) || 10,
                filter,
                sort,
                populate: populateOptions
            });

            // Sanitize the tenant data to remove sensitive fields
            const sanitizedTenants = DataSanitizer.sanitizeData<ITenant[]>(result.items, ['databasePassword','updatedBy','__v']);

            // Emit audit event for tenant list access
            EventService.emitAuditTrail(
                'tenant_list_accessed',
                'tenant_list',
                'system',
                req.userId || 'anonymous',
                {
                    totalTenants: result.total || result.items?.length || 0,
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
                message: "Tenants retrieved successfully",
                statusCode: 200
            });
        } catch (error) {
            // Enhanced error handling for tenant listing
            if (isValidationError(error)) {
                return errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 400,
                    details: error.details
                });
            }

            if (isDatabaseError(error)) {
                Logging.error("Database error in tenant listing:", error);
                return errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
            }

            // Log unexpected errors
            Logging.error("Unexpected error in tenant listing:", error);
            return errorResponse.sendError({
                res,
                message: "Internal Server Error",
                statusCode: 500
            });
        }
    }


    private getTenant = async (req: Request , res: Response, next: NextFunction)=>  {
        const { id } = req.params;
        
        try {
            // Validation
            if(!id){
                throw new ValidationError("Tenant ID is required", ["id: Tenant ID is required"]);
            }

            const tenant = await this.tenantService.findByIdWithRelations(id);
            if(!tenant){
                throw new NotFoundError("Tenant not found", "tenant", id);
            }
            
            const sanitizedTenant = DataSanitizer.sanitizeData<ITenant>(tenant, ['databasePassword','__v','createdAt','updatedAt', 'databaseUser','databaseName']);

            // Emit tenant viewed event
            EventService.emitAuditTrail(
                'tenant_viewed',
                'tenant',
                id,
                req.userId || 'anonymous',
                {
                    tenantName: tenant.name,
                    subdomain: tenant.subdomain
                },
                EventService.createContextFromRequest(req)
            );
            
            return responseResult.sendResponse({
                res,
                data: sanitizedTenant,
                message: "Tenant retrieved successfully",
                statusCode: 200
            });
        } catch (error) {
            // Enhanced error handling for tenant retrieval
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
                Logging.error("Database error in tenant retrieval:", error);
                return errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
            }

            // Log unexpected errors
            Logging.error("Unexpected error in tenant retrieval:", error);
            return errorResponse.sendError({
                res,
                message: "Internal Server Error",
                statusCode: 500
            });
        }
    }

    private update = async (req: Request , res: Response, next: NextFunction)=>  {
        const userId = req.userId; // Assuming req.user is populated by authentication middleware
        const { id } = req.params;
        const {name, subdomain} = req.body;
        
        try {
            // Validation checks
            if(!id){
                throw new ValidationError("Tenant ID is required", ["id: Tenant ID is required"]);
            }
            
            if(!name || !subdomain){
                throw new ValidationError("Name and Subdomain are required", [
                    !name ? "name: Name is required" : "",
                    !subdomain ? "subdomain: Subdomain is required" : ""
                ].filter(Boolean));
            }

            // Check if tenant exists
            const existingTenant = await this.tenantService.findByIdWithRelations(id);
            if(!existingTenant){
                throw new NotFoundError("Tenant not found", "tenant", id);
            }

            // Check for name conflicts (only if name is changing)
            if(existingTenant.name !== name){
                const isNameTaken = await this.tenantService.checkTenantExists(name);
                if(isNameTaken){
                    throw new ConflictError("Name is already in use", "name", name);
                }
            }

            // Check for subdomain conflicts (only if subdomain is changing)
            if(existingTenant.subdomain !== subdomain){
                const isAvailable = await this.tenantService.checkSubdomainAvailability(subdomain);
                if(!isAvailable){
                    throw new ConflictError("Subdomain is already in use", "subdomain", subdomain);
                }
            }

            // Update tenant
            const updatedTenant = await this.tenantService.update(id, { name, subdomain, updatedBy: userId });
            if(!updatedTenant){
                throw new UpdateFailedError(
                    "Failed to update tenant", 
                    "tenant", 
                    id, 
                    "Database operation failed", 
                    ["name", "subdomain"]
                );
            }
            const sanitizedTenant = DataSanitizer.sanitizeData<ITenant>(updatedTenant, ['databasePassword']);
            
            // Emit comprehensive tenant update events
            EventService.emitTenantUpdated({
                tenantId: id,
                previousData: existingTenant,
                newData: updatedTenant,
                updatedFields: ['name', 'subdomain'],
                updatedBy: userId!
            }, EventService.createContextFromRequest(req));

            // Emit audit trail
            EventService.emitAuditTrail(
                'tenant_updated',
                'tenant',
                id,
                userId!,
                {
                    previousData: {
                        name: existingTenant.name,
                        subdomain: existingTenant.subdomain
                    },
                    newData: {
                        name: updatedTenant.name,
                        subdomain: updatedTenant.subdomain
                    },
                    updatedFields: ['name', 'subdomain']
                },
                EventService.createContextFromRequest(req)
            );

            // Emit CRUD operation event
            EventService.emitCrudOperation({
                operation: 'update',
                resource: 'tenant',
                resourceId: id,
                userId: userId!,
                data: sanitizedTenant,
                previousData: DataSanitizer.sanitizeData<ITenant>(existingTenant, ['databasePassword'])
            }, EventService.createContextFromRequest(req));

            return responseResult.sendResponse({
                res,
                data: sanitizedTenant,
                message: "Tenant updated successfully",
                statusCode: 200
            });
        } catch (error) {
            // Enhanced error handling for tenant update
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

            if (isUpdateFailedError(error)) {
                Logging.warn("Tenant update failed:", error);
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
                Logging.error("Database error in tenant update:", error);
                return errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
            }

            // Log unexpected errors
            Logging.error("Unexpected error in tenant update:", error);
            return errorResponse.sendError({
                res,
                message: "Internal Server Error",
                statusCode: 500
            });
        }
    }


    private delete = async (req: Request , res: Response, next: NextFunction)=>  {
        const { id } = req.params;
        
        try {
            // Validation
            if(!id){
                throw new ValidationError("Tenant ID is required", ["id: Tenant ID is required"]);
            }

            // Check if tenant exists
            const existingTenant = await this.tenantService.findByIdWithRelations(id);
            if(!existingTenant){
                throw new NotFoundError("Tenant not found", "tenant", id);
            }

            // Delete tenant
            try {
                await this.tenantService.deleteTenant(id);
            } catch (deleteError) {
                throw new DeletionFailedError(
                    "Failed to delete tenant", 
                    "tenant", 
                    id, 
                    "Tenant may have dependencies or database operation failed"
                );
            }
            
            // Emit comprehensive tenant deletion events
            EventService.emitTenantDeleted(
                id, 
                req.userId!, 
                EventService.createContextFromRequest(req)
            );

            // Emit audit trail
            EventService.emitAuditTrail(
                'tenant_deleted',
                'tenant',
                id,
                req.userId!,
                {
                    tenantName: existingTenant.name,
                    subdomain: existingTenant.subdomain,
                    databaseName: existingTenant.databaseName,
                    deleted: true
                },
                EventService.createContextFromRequest(req)
            );

            // Emit CRUD operation event
            EventService.emitCrudOperation({
                operation: 'delete',
                resource: 'tenant',
                resourceId: id,
                userId: req.userId!,
                previousData: DataSanitizer.sanitizeData<ITenant>(existingTenant, ['databasePassword'])
            }, EventService.createContextFromRequest(req));

            return responseResult.sendResponse({
                res,
                data: { deleted: true },
                message: "Tenant deleted successfully",
                statusCode: 200
            });
        } catch (error) {
            // Enhanced error handling for tenant deletion
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
                Logging.warn("Tenant deletion failed:", error);
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
                Logging.error("Database error in tenant deletion:", error);
                return errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
            }

            // Log unexpected errors
            Logging.error("Unexpected error in tenant deletion:", error);
            return errorResponse.sendError({
                res,
                message: "Internal Server Error",
                statusCode: 500
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
                'tenant_cache_cleared',
                'cache',
                'tenant_cache',
                req.userId || 'system',
                {
                    patterns: patterns || 'all',
                    clearedCount: totalCleared
                },
                EventService.createContextFromRequest(req)
            );

            return responseResult.sendResponse({
                res,
                data: { cleared: totalCleared },
                message: `Tenant cache cleared (${totalCleared} keys)`,
                statusCode: 200
            });
        } catch (error) {
            // Enhanced error handling for cache clearing
            if (isDatabaseError(error)) {
                Logging.error("Database error in cache clearing:", error);
                return errorResponse.sendError({
                    res,
                    message: "Database operation failed during cache clearing",
                    statusCode: 500
                });
            }

            // Log unexpected errors
            Logging.error("Unexpected error in cache clearing:", error);
            return errorResponse.sendError({
                res,
                message: 'Failed to clear tenant cache',
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
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
                message: 'Tenant cache stats retrieved',
                statusCode: 200
            });
        } catch (error) {
            // Enhanced error handling for cache stats
            if (isDatabaseError(error)) {
                Logging.error("Database error in cache stats retrieval:", error);
                return errorResponse.sendError({
                    res,
                    message: "Database operation failed during cache stats retrieval",
                    statusCode: 500
                });
            }

            // Log unexpected errors
            Logging.error("Unexpected error in cache stats retrieval:", error);
            return errorResponse.sendError({
                res,
                message: 'Failed to get tenant cache stats',
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    }

    private getTenantStats = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Get basic tenant statistics using existing methods
            const allTenantsResult = await this.tenantService.getTenantsWithPagination({
                page: 1,
                limit: 1000, // Get a large number to count all
                filter: {}
            });
            
            const totalTenants = allTenantsResult.total;
            
            // For now, assume all tenants are active (you can add status field later)
            const activeTenants = totalTenants;
            
            // Get recent tenants (last 7 days)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const recentTenantsResult = await this.tenantService.getTenantsWithPagination({
                page: 1,
                limit: 1000,
                filter: {
                    createdAt: { $gte: sevenDaysAgo }
                }
            });
            
            const recentTenants = recentTenantsResult.total;
            
            const stats = {
                total: totalTenants,
                active: activeTenants,
                recent: recentTenants,
                inactive: 0, // Assuming all are active for now
                timestamp: new Date().toISOString()
            };

            // Emit stats access event
            EventService.emitAuditTrail(
                'tenant_stats_accessed',
                'tenant_stats',
                'system',
                req.userId || 'anonymous',
                stats,
                EventService.createContextFromRequest(req)
            );

            return responseResult.sendResponse({
                res,
                data: stats,
                message: 'Tenant statistics retrieved successfully',
                statusCode: 200
            });
        } catch (error) {
            // Enhanced error handling for tenant statistics
            if (isDatabaseError(error)) {
                Logging.error("Database error in tenant statistics retrieval:", error);
                return errorResponse.sendError({
                    res,
                    message: "Database operation failed during statistics retrieval",
                    statusCode: 500
                });
            }

            // Log unexpected errors
            Logging.error("Unexpected error in tenant statistics retrieval:", error);
            return errorResponse.sendError({
                res,
                message: 'Failed to get tenant statistics',
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    }
}

export default new TenantController().router;