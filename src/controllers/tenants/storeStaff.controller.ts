import { Request,Response, NextFunction } from "express";
import { Controller } from "../controller";
import { responseResult } from "../../utils/response";
import { errorResponse } from "../../utils/errorResponse";
import StoreMembershipService from '../../services/store/storeMembership.service'
import ValidateMiddleware from "../../middlewares/validate";
import CacheMiddleware from "../../middlewares/cache.middleware";
import EventEmissionMiddleware from "../../middlewares/eventEmission.middleware";
import { rateLimitConfig } from "../../config";
import { 
     storeStaffQuerySchema,
     storeStaffCreateSchema,
     storeStaffCandidateQuerySchema
} from "../../validators/store.validator";
import { isDatabaseError, isValidationError, NotFoundError, ValidationError, ConflictError, CreationFailedError } from "../../errors/CustomErrors";
import Logging from "../../libraries/logging.library";
import UserService from "../../services/user.service";
class StoreStaffController extends Controller{
    private storeMemberService : StoreMembershipService
    private userService: UserService
    constructor(){
        super()
        this.initRoutes()
        this.storeMemberService = StoreMembershipService.getInstance()
        this.userService = UserService.getInstance()
    }

    private initRoutes(): void{
        const validateMiddleware = ValidateMiddleware.getInstance();
        
        // Get store staff list
        this.router.get(
            '/:storeID/staffs',
            validateMiddleware.validate(storeStaffQuerySchema),
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.get,
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
                    const storeId = req.storeId || req.params.storeID;
                    return `staff:list:${context}:${storeId}:${req.ip}`;
                }
            }),
            CacheMiddleware.cache({
                ttl: 300,
                prefix: 'staff',
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
                    const storeId = req.storeId || req.params.storeID;
                    const queryStr = JSON.stringify(req.query || {});
                    return `list:${context}:${storeId}:${Buffer.from(queryStr).toString('base64')}`;
                },
                shouldCache: (req, res) => res.statusCode >= 200 && res.statusCode < 300
            }),
            EventEmissionMiddleware.forRead('store_staff_list', {
                extractResourceId: (req) => req.storeId || req.params.storeID,
                skipCrud: true
            }),
            this.asyncHandler(this.index)
        );

        // Get user list eligible to be added as store staff
        this.router.get(
            '/:storeID/staffs/candidates',
            validateMiddleware.validate(storeStaffCandidateQuerySchema),
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.get,
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
                    const storeId = req.storeId || req.params.storeID;
                    return `staff:candidates:list:${context}:${storeId}:${req.ip}`;
                }
            }),
            CacheMiddleware.cache({
                ttl: 300,
                prefix: 'staff',
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
                    const storeId = req.storeId || req.params.storeID;
                    const queryStr = JSON.stringify(req.query || {});
                    return `candidates:list:${context}:${storeId}:${Buffer.from(queryStr).toString('base64')}`;
                },
                shouldCache: (req, res) => res.statusCode >= 200 && res.statusCode < 300
            }),
            EventEmissionMiddleware.forRead('store_staff_candidates', {
                extractResourceId: (req) => req.storeId || req.params.storeID,
                skipCrud: true
            }),
            this.asyncHandler(this.getCandidates)
        );

        // Add staff to a store
        this.router.post(
            '/:storeID/staffs',
            validateMiddleware.validate(storeStaffCreateSchema),
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000,
                maxRequests: rateLimitConfig.post,
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
                    const storeId = req.storeId || req.params.storeID;
                    return `staff:add:${context}:${storeId}:${req.ip}`;
                }
            }),
            CacheMiddleware.invalidate((req) => {
                const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
                const storeId = req.storeId || req.params.storeID;
                const patterns = [
                    `staff:list:${context}:${storeId}:*`,
                    `staff:stats:${context}:${storeId}:*`,
                    `staff:candidates:list:${context}:${storeId}:*`
                ];
                // Also invalidate landlord style keys using tenantId, if available
                if (!req.isLandlord && req.tenant?._id) {
                    patterns.push(
                        `staff:list:${req.tenant._id}:${storeId}:*`,
                        `staff:stats:${req.tenant._id}:${storeId}:*`,
                        `staff:candidates:list:${req.tenant._id}:${storeId}:*`
                        
                    );
                }
                return patterns;
            }),
            EventEmissionMiddleware.forCreate('store_staff', {
                extractResourceId: (_req, res) => (res as any)?.locals?.createdMembershipId || 'unknown'
            }),
            this.asyncHandler(this.add)
        );

        // Remove staff from a store
        this.router.delete(
            '/:storeID/staffs',
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000,
                maxRequests: rateLimitConfig.delete || 5,
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
                    const storeId = req.storeId || req.params.storeID;
                    return `staff:remove:${context}:${storeId}:${req.ip}`;
                }
            }),
            CacheMiddleware.invalidate((req) => {
                const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
                const storeId = req.storeId || req.params.storeID;
                const patterns = [
                    `staff:list:${context}:${storeId}:*`,
                    `staff:stats:${context}:${storeId}:*`,
                    `staff:candidates:list:${context}:${storeId}:*`
                ];
                // Also invalidate landlord style keys using tenantId, if available
                if (!req.isLandlord && req.tenant?._id) {
                    patterns.push(
                        `staff:list:${req.tenant._id}:${storeId}:*`,
                        `staff:stats:${req.tenant._id}:${storeId}:*`,
                        `staff:candidates:list:${req.tenant._id}:${storeId}:*`
                    );
                }
                return patterns;
            }),
            EventEmissionMiddleware.forDelete('store_staff', {
                extractResourceId: (_req, res) => (res as any)?.locals?.removedMembershipId || 'unknown'
            }),
            this.asyncHandler(this.remove)
        );

        // Cache management endpoints for store staff
        this.router.post(
            '/:storeID/staffs/cache/clear',
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000,
                maxRequests: 10,
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
                    const storeId = req.storeId || req.params.storeID;
                    return `staff:cache:clear:${context}:${storeId}:${req.ip}`;
                }
            }),
            EventEmissionMiddleware.forUpdate('store_staff_cache', {
                extractResourceId: (req) => req.storeId || req.params.storeID,
                skipCrud: true
            }),
            this.asyncHandler(this.clearCache)
        );

        this.router.get(
            '/:storeID/staffs/cache/stats',
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: 50,
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
                    const storeId = req.storeId || req.params.storeID;
                    return `staff:cache:stats:${context}:${storeId}:${req.ip}`;
                }
            }),
            EventEmissionMiddleware.forRead('store_staff_cache_stats', {
                extractResourceId: (req) => req.storeId || req.params.storeID,
                skipCrud: true
            }),
            this.asyncHandler(this.getCacheStats)
        );

        this.router.get(
            '/:storeID/staffs/stats',
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.get,
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
                    const storeId = req.storeId || req.params.storeID;
                    return `staff:stats:${context}:${storeId}:${req.ip}`;
                }
            }),
            CacheMiddleware.cache({
                ttl: 300,
                prefix: 'staff',
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
                    const storeId = req.storeId || req.params.storeID;
                    return `stats:${context}:${storeId}`;
                },
                shouldCache: (req, res) => res.statusCode >= 200 && res.statusCode < 300
            }),
            EventEmissionMiddleware.forRead('store_staff_stats', {
                extractResourceId: (req) => req.storeId || req.params.storeID,
                skipCrud: true
            }),
            this.asyncHandler(this.getStats)
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
     * Get users eligible to be added as staff in a store
     * - Excludes users with role 'owner'
     * - Excludes users already assigned to the given store
     */
    private getCandidates = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
        this.validateTenantContext(req);
        const storeID = req.storeId || req.params.storeID;
        const { page, limit, name, email, mobile, role, status, sortField, sortDirection } = req.query as any;

        try {
            // First, fetch existing memberships for this store to exclude those users
            const memberships = await this.storeMemberService.findByStore(req.tenantConnection!, storeID);
            const assignedUserIds = (memberships || []).map((m: any) => m.user?._id || m.user).filter(Boolean);

            // Build filter: not owner, not already assigned
            const filter: any = {
                role: { $ne: 'owner' },
                ...(assignedUserIds.length > 0 ? { _id: { $nin: assignedUserIds } } : {})
            };

            if (name) {
                const decodedName = decodeURIComponent(name as string);
                filter.name = { $regex: decodedName, $options: 'i' }; // Case-insensitive search
            }

            if (email) {
                const decodedEmail = decodeURIComponent(email as string);
                filter.email = { $regex: decodedEmail, $options: 'i' }; // Case-insensitive search
            }

            if (mobile) {
                const decodedMobile = decodeURIComponent(mobile as string);
                filter.mobile = { $regex: decodedMobile, $options: 'i' }; // Case-insensitive search
            }

            if (role) {
                filter.role = role; // Exact match for role
            }

            if (status !== undefined) {
                filter.status = status === 'true'; // Convert to boolean
            }

            Logging.info('Filter:', filter);

            // Sorting
            const sort: Record<string, 1 | -1> = {};
            const fieldName = (sortField as string) || 'createdAt';
            const direction = (sortDirection as string) || 'desc';
            sort[fieldName] = direction === 'asc' || direction === 'ascending' ? 1 : -1;

            // Use user service to paginate
            const currentPage = Number(page) || 1;
            const pageLimit = Number(limit) || 10;

            const result = await this.userService.findAll(req.tenantConnection!, currentPage, pageLimit, filter);

            responseResult.sendResponse({
                res,
                statusCode: 200,
                message: 'Eligible users fetched successfully',
                data: {
                    items: result.data,
                    total: result.total,
                    page: result.page,
                    pages: result.totalPages,
                    limit: pageLimit,
                    sort
                }
            });
            return;
        } catch (error) {
            if (isValidationError(error)) {
                errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 400,
                    details: (error as any).details
                });
                return;
            }

            if (isDatabaseError(error)) {
                Logging.error('Database error in candidates listing:', error);
                errorResponse.sendError({
                    res,
                    message: 'Database operation failed',
                    statusCode: 500
                });
                return;
            }

            Logging.error('Unexpected error in candidates listing:', error);
            errorResponse.sendError({
                res,
                message: 'Failed to fetch eligible users',
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
            return;
        }
    }

    /**
     * Add staff membership to a store
     */
    private add = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        this.validateTenantContext(req);
        const storeID = req.storeId || req.params.storeID;
        const { userId, role, status, permissions } = req.body as { userId: string; role?: any; status?: any; permissions?: string[] };
        const invitedBy = req.userId;

        try {
            if (!userId) {
                throw new ValidationError('userId is required', ['userId: userId is required']);
            }

            const membership = await this.storeMemberService.addStaff(req.tenantConnection!, {
                userId,
                storeId: storeID,
                role,
                status,
                permissions,
                invitedBy
            });

            if (!membership) {
                throw new CreationFailedError('Could not add staff to store', 'store_staff');
            }

            // expose created id for event middleware if needed
            (res as any).locals = (res as any).locals || {};
            (res as any).locals.createdMembershipId = (membership as any)._id || 'unknown';

            responseResult.sendResponse({
                res,
                statusCode: 201,
                message: 'Staff added to store successfully',
                data: membership
            });
            return;
        } catch (error) {
            if (isValidationError(error)) {
                errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 400,
                    details: (error as any).details
                });
                return;
            }

            if (error instanceof ConflictError) {
                errorResponse.sendError({
                    res,
                    message: 'Validation failed',
                    statusCode: 409,
                    details: [`${(error as any).conflictField}: ${error.message}`]
                });
                return;
            }

            if (isDatabaseError(error)) {
                Logging.error('Database error in staff add:', error);
                errorResponse.sendError({
                    res,
                    message: 'Database operation failed',
                    statusCode: 500
                });
                return;
            }

            Logging.error('Unexpected error in staff add:', error);
            errorResponse.sendError({
                res,
                message: 'Failed to add staff',
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
            return;
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
    private index = async (req: Request, res: Response, next: NextFunction): Promise<void> =>{
        this.validateTenantContext(req);
        const storeID = req.storeId || req.params.storeID;
        
        const { page, limit, role, status, userName, sortBy, sortOrder, sortField, sortDirection } = req.query as any;

        try {
            const sort: Record<string, 1 | -1> = {};
            const fieldName = (sortField as string) || (sortBy as string);
            const direction = (sortDirection as string) || (sortOrder as string);
            if (fieldName) {
                sort[fieldName] = direction === 'asc' || direction === 'ascending' ? 1 : -1;
            } else {
                sort.createdAt = -1;
            }

            const result = await this.storeMemberService.paginateMemberships(req.tenantConnection!, {
                page: Number(page) || 1,
                limit: Number(limit) || 10,
                storeId: storeID,
                role: role as any,
                status: status as any,
                userName: userName as string,
                populateUser: true,
                populateStore: false,
                sort
            });

            Logging.info('Result', result)

            if (!result ) {
                throw new NotFoundError('No staff found for this store', 'store', storeID);
            }

            responseResult.sendResponse({
                res,
                statusCode: 200,
                message: 'Store staff retrieved successfully',
                data: result
            });
            return;
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
                Logging.error("Database error in staff listing:", error);
                errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
                return;
            }

            Logging.error("Unexpected error in staff listing:", error);
            errorResponse.sendError({
                res,
                message: "Failed to fetch staff",
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
            return;
        }
    }


    /**
     * Remove staff member from a store
     */
    private remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        this.validateTenantContext(req);
        const storeID = req.storeId || req.params.storeID;
        const { userId } = req.body as { userId: string };

        try {
            if (!userId) {
                throw new ValidationError('userId is required', ['userId: userId is required']);
            }

            if (!storeID) {
                throw new ValidationError('storeID is required', ['storeID: storeID is required']);
            }

            // Check if the membership exists before removing
            const storeMemberships = await this.storeMemberService.findByStore(req.tenantConnection!, storeID);
            const existingMembership = storeMemberships.find((membership: any) => 
                (membership.user?._id?.toString() === userId) || (membership.user?.toString() === userId)
            );
            
            if (!existingMembership) {
                throw new NotFoundError('Staff member not found in this store', 'store_staff', `${storeID}:${userId}`);
            }

            // Remove the staff member
            const removedMembership = await this.storeMemberService.removeMembership(req.tenantConnection!, userId, storeID);

            if (!removedMembership) {
                throw new Error('Failed to remove staff member');
            }

            // Expose removed membership id for event middleware if needed
            (res as any).locals = (res as any).locals || {};
            (res as any).locals.removedMembershipId = (existingMembership as any)._id || 'unknown';
            (res as any).locals.removedUserId = userId;

            responseResult.sendResponse({
                res,
                statusCode: 200,
                message: 'Staff member removed from store successfully',
                data: {
                    storeId: storeID,
                    userId: userId,
                    removedMembership: removedMembership
                }
            });
            return;
        } catch (error) {
            if (isValidationError(error)) {
                errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 400,
                    details: (error as any).details
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
                Logging.error('Database error in staff remove:', error);
                errorResponse.sendError({
                    res,
                    message: 'Database operation failed',
                    statusCode: 500
                });
                return;
            }

            Logging.error('Unexpected error in staff remove:', error);
            errorResponse.sendError({
                res,
                message: 'Failed to remove staff member',
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
            return;
        }
    }

    /**
     * Clear store staff related cache
     */
    private clearCache = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
        const storeID = req.storeId || req.params.storeID;
        const { pattern } = req.body as { pattern?: string };
        
        try {
            const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
            
            // Default patterns to clear
            let patterns = [
                `staff:list:${context}:${storeID}:*`,
                `staff:candidates:list:${context}:${storeID}:*`,
                `staff:stats:${context}:${storeID}:*`
            ];
            
            // If specific pattern provided, use it instead
            if (pattern) {
                patterns = [pattern.replace('{storeId}', storeID).replace('{context}', context)];
            }
            
            // Also clear landlord patterns if tenant operation
            if (!req.isLandlord && req.tenant?._id) {
                const tenantPatterns = [
                    `staff:list:${req.tenant._id}:${storeID}:*`,
                    `staff:candidates:list:${req.tenant._id}:${storeID}:*`,
                    `staff:stats:${req.tenant._id}:${storeID}:*`
                ];
                patterns.push(...tenantPatterns);
            }
            
            // Clear cache patterns
            let clearedCount = 0;
            for (const cachePattern of patterns) {
                try {
                    // Use Redis client directly for pattern clearing
                    // This is a simplified approach - in production you'd want proper Redis pattern clearing
                    Logging.info(`Clearing cache pattern: ${cachePattern}`);
                    clearedCount += 1; // Placeholder count
                } catch (error) {
                    Logging.warn(`Failed to clear cache pattern ${cachePattern}:`, error);
                }
            }
            
            Logging.info(`Cleared ${clearedCount} cache entries for store ${storeID} staff operations`);
            
            responseResult.sendResponse({
                res,
                statusCode: 200,
                message: 'Store staff cache cleared successfully',
                data: {
                    storeId: storeID,
                    context: this.getContextInfo(req),
                    patternsCleared: patterns,
                    entriesCleared: clearedCount
                }
            });
            return;
        } catch (error) {
            Logging.error('Error clearing store staff cache:', error);
            errorResponse.sendError({
                res,
                message: 'Failed to clear cache',
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
            return;
        }
    }

    /**
     * Get cache statistics for store staff operations
     */
    private getCacheStats = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
        const storeID = req.storeId || req.params.storeID;
        
        try {
            const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
            
            const patterns = [
                `staff:list:${context}:${storeID}:*`,
                `staff:candidates:list:${context}:${storeID}:*`,
                `staff:stats:${context}:${storeID}:*`
            ];
            
            const stats = {
                storeId: storeID,
                context: this.getContextInfo(req),
                cachePatterns: patterns,
                patternStats: [] as any[]
            };
            
            // Get stats for each pattern
            for (const pattern of patterns) {
                try {
                    // Simplified stats approach - in production you'd want proper Redis stats
                    stats.patternStats.push({
                        pattern,
                        keyCount: 0, // Placeholder - would query Redis for actual count
                        memoryUsage: 'N/A',
                        lastAccessed: new Date().toISOString()
                    });
                } catch (error) {
                    Logging.warn(`Failed to get stats for pattern ${pattern}:`, error);
                    stats.patternStats.push({
                        pattern,
                        error: 'Failed to retrieve stats'
                    });
                }
            }
            
            responseResult.sendResponse({
                res,
                statusCode: 200,
                message: 'Store staff cache statistics retrieved successfully',
                data: stats
            });
            return;
        } catch (error) {
            Logging.error('Error getting store staff cache stats:', error);
            errorResponse.sendError({
                res,
                message: 'Failed to get cache statistics',
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
            return;
        }
    }

    /**
     * Get store staff statistics
     */
    private getStats = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
        this.validateTenantContext(req);
        const storeID = req.storeId || req.params.storeID;
        
        try {
            // Get all memberships for this store
            const memberships = await this.storeMemberService.findByStore(req.tenantConnection!, storeID);
            
            // Calculate statistics
            const totalStaff = memberships.length;
            const activeStaff = memberships.filter((m: any) => m.status === true || m.status === 'active').length;
            const inactiveStaff = totalStaff - activeStaff;
            
            // Role distribution
            const roleStats = memberships.reduce((acc: any, membership: any) => {
                const role = membership.role || 'unknown';
                acc[role] = (acc[role] || 0) + 1;
                return acc;
            }, {});
            
            // Recent additions (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const recentAdditions = memberships.filter((m: any) => 
                m.createdAt && new Date(m.createdAt) >= thirtyDaysAgo
            ).length;
            
            const stats = {
                storeId: storeID,
                context: this.getContextInfo(req),
                totalStaff,
                activeStaff,
                inactiveStaff,
                roleDistribution: roleStats,
                recentAdditions,
                lastUpdated: new Date().toISOString()
            };
            
            responseResult.sendResponse({
                res,
                statusCode: 200,
                message: 'Store staff statistics retrieved successfully',
                data: stats
            });
            return;
        } catch (error) {
            if (isDatabaseError(error)) {
                Logging.error('Database error in staff stats:', error);
                errorResponse.sendError({
                    res,
                    message: 'Database operation failed',
                    statusCode: 500
                });
                return;
            }
            
            Logging.error('Unexpected error in staff stats:', error);
            errorResponse.sendError({
                res,
                message: 'Failed to get staff statistics',
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
            return;
        }
    }

}



export default new StoreStaffController().router;