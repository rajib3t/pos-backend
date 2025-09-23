import { Request, Response, NextFunction } from 'express';
import { Controller } from "../controller";
import { responseResult } from "../../utils/response";
import { errorResponse } from "../../utils/errorResponse";
import StoreService from "../../services/store/store.service";
import { DateUtils } from '../../utils/dateUtils';
import Logging from '../../libraries/logging.library';
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
} from '../../errors/CustomErrors';
import EventService from '../../events/EventService';
import { rateLimitConfig } from '../../config';
import CacheMiddleware from '../../middlewares/cache.middleware';
import EventEmissionMiddleware from '../../middlewares/eventEmission.middleware';
import ValidateMiddleware from '../../middlewares/validate';
import { storeQuerySchema } from '../../validators/store.validator';
import { IStore } from '../../models/store/store.model';

class StoreController extends Controller{
    private storeService: StoreService;
    

    constructor() {
        super();
        this.storeService = StoreService.getInstance();
        
        this.initializeRoutes();
    }

    private initializeRoutes() {
        const validateMiddleware = ValidateMiddleware.getInstance();
        this.router.get("/",
            validateMiddleware.validate(storeQuerySchema),
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.get,
                keyGenerator: (req) => `stores:list:${req.ip}:${req.isLandlord ? 'landlord' : req.tenant?.subdomain}`
            }),
            CacheMiddleware.cache({
                ttl: 300,
                prefix: 'stores',
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
            EventEmissionMiddleware.forRead('stores_list', {
                extractResourceId: (req) => req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown'),
                skipCrud: true
            }),
            this.asyncHandler(this.index)
        );
        this.router.post("/",
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000,
                maxRequests: rateLimitConfig.post,
                keyGenerator: (req) => `store:create:${req.ip}:${req.isLandlord ? 'landlord' : req.tenant?.subdomain}`
            }),
            CacheMiddleware.invalidate((req) => {
                const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                const patterns = [
                    `stores:list:${context}:*`,
                    `stores:stats:${context}:*`
                ];
                
                // If tenant operation, also invalidate landlord cache keys that use tenantId
                if (!req.isLandlord && req.tenant?._id) {
                    patterns.push(
                        `stores:list:${req.tenant._id}:*`,
                        `stores:stats:${req.tenant._id}:*`,
                    );
                }
                
                return patterns;
            }),
            EventEmissionMiddleware.forCreate('store'),
            this.asyncHandler(this.create.bind(this))
        )
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
     * Get all stores with pagination
     */
    private async index(req: Request, res: Response, next: NextFunction): Promise<void> {
        
        const { 
            page, 
            limit, 
            name, 
            code, 
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
            this.validateTenantContext(req);
            const filter: any = {};
            
            if (name) {
                filter.name = { $regex: name, $options: 'i' }; // Case-insensitive search
            }

            if (code) {
                filter.code = { $regex: code, $options: 'i' }; // Case-insensitive search
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
             const result = await this.storeService.getDataWithPagination(req.tenantConnection!, {
                page: Number(page) || 1,
                limit: Number(limit) || 10,
                filter,
                sort
            });
            if (!result) {
                throw new NotFoundError("No stores found", "stores", req.isLandlord ? 'landlord' : req.tenant?._id as string);
            }

            // Emit audit event for user list access
            EventService.emitAuditTrail(
                'store_list_accessed',
                'store_list',
                req.isLandlord ? 'landlord' : req.tenant?._id as string,
                'system', // or req.userId if available
                {
                    totalStores: (result as any).total || (result as any).totalCount || result.items?.length || 0,
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
                data: result,
                message: 'Stores retrieved successfully',
                statusCode: 200
            });
            return;

            
          
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
                Logging.error("Database error in stores listing:", error);
                errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
                return;
            }

            // Log unexpected errors
            Logging.error("Unexpected error in stores listing:", error);
            errorResponse.sendError({
                res,
                message: "Failed to fetch stores",
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    }


    /**
     * Create Store 
     */
    private create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const userId = req.params.userId;
        const { name, code, email, mobile} = req.body;
        console.log(req.tenantConnection);
        
        try {
            this.validateTenantContext(req);
                // Validation checks
                if(!name || !code){
                    throw new ValidationError("Name and code are required", [
                        !name ? "name: Name is required" : "",
                        !code ? "code: code is required" : ""
                    ].filter(Boolean));
                }

            // Check for existing name
            const isNameTaken = await this.storeService.findAllByKey(req.tenantConnection!,name);
            if(isNameTaken &&  isNameTaken.length > 0){

            
                throw new ConflictError("Name is already in use", "name", name);
            }
            // Check for existing name
            const isCodeTaken = await this.storeService.findAllByKey(req.tenantConnection!,code);
            if(isCodeTaken &&  isCodeTaken.length > 0){

            
                throw new ConflictError("Code is already in use", "code", name);
            }
            const newStore: Partial<IStore> = {
                name,
                code,
                mobile,
                email,
                createdBy:userId,
                status:'active'
            }
            const store  = await this.storeService.create(req.tenantConnection!,newStore);
            if(!store){
                throw new CreationFailedError("Could not create store", "stores");
            }

            responseResult.sendResponse({
                res,
                statusCode:201,
                message:'Store created successfully',
                data:store
            })
            return;


        } catch (error) {
            // Enhanced error handling for user creation
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
                return
            }

            if (error instanceof ConflictError) {
                 errorResponse.sendError({
                    res,
                    message: "Validation failed",
                    statusCode: 409,
                    details: [`${error.conflictField}: ${error.message}`]
                });
                return;
            }

            if (isCreationFailedError(error)) {
                Logging.warn("User creation failed:", error);
                 errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 422,
                    details: {
                        resource: error.resource,
                        reason: error.reason,
                        failedFields: error.failedFields
                    }
                });
                return
            }

            if (isDatabaseError(error)) {
                Logging.error("Database error in store creation:", error);
                 errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
                return;
            }

            // Log unexpected errors
            Logging.error("Unexpected error in store creation:", error);
             errorResponse.sendError({
                res,
                message: "Failed to create store",
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
            return;

        }
    }

    
}

export default new StoreController().router;