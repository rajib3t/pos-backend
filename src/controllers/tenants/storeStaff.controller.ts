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
     storeStaffCreateSchema
} from "../../validators/store.validator";
import { isDatabaseError, isValidationError, NotFoundError, ValidationError, ConflictError, CreationFailedError } from "../../errors/CustomErrors";
import Logging from "../../libraries/logging.library";
class StoreStaffController extends Controller{
    private storeMemberService : StoreMembershipService
    constructor(){
        super()
        this.initRoutes()
        this.storeMemberService = StoreMembershipService.getInstance()
    }

    private initRoutes(): void{
        const validateMiddleware = ValidateMiddleware.getInstance();
        this.router.get(
            '/:storeID/staffs',
            validateMiddleware.validate(storeStaffQuerySchema),
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.get,
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
                    return `staff:list:${context}:${req.params.storeID}:${req.ip}`;
                }
            }),
            CacheMiddleware.cache({
                ttl: 300,
                prefix: 'staff',
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
                    const queryStr = JSON.stringify(req.query || {});
                    return `list:${context}:${req.params.storeID}:${Buffer.from(queryStr).toString('base64')}`;
                },
                shouldCache: (req, res) => res.statusCode >= 200 && res.statusCode < 300
            }),
            EventEmissionMiddleware.forRead('store_staff_list', {
                extractResourceId: (req) => req.params.storeID,
                skipCrud: true
            }),
            this.asyncHandler(this.index)
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
                    return `staff:add:${context}:${req.params.storeID}:${req.ip}`;
                }
            }),
            CacheMiddleware.invalidate((req) => {
                const context = req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown');
                const patterns = [
                    `staff:list:${context}:${req.params.storeID}:*`,
                    `staff:stats:${context}:${req.params.storeID}:*`
                ];
                // Also invalidate landlord style keys using tenantId, if available
                if (!req.isLandlord && req.tenant?._id) {
                    patterns.push(
                        `staff:list:${req.tenant._id}:${req.params.storeID}:*`,
                        `staff:stats:${req.tenant._id}:${req.params.storeID}:*`
                    );
                }
                return patterns;
            }),
            EventEmissionMiddleware.forCreate('store_staff', {
                extractResourceId: (_req, res) => (res as any)?.locals?.createdMembershipId || 'unknown'
            }),
            this.asyncHandler(this.add)
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
     * Add staff membership to a store
     */
    private add = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        this.validateTenantContext(req);
        const { storeID } = req.params;
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
        const storeID = req.params.storeID;
        
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

}



export default new StoreStaffController().router;