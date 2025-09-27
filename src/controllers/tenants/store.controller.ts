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
import { storeQuerySchema , createStoreSchema, updateStoreSchema, getStoreSchema, deleteStoreSchema} from '../../validators/store.validator';
import { IStore } from '../../models/store/store.model';
import { th } from 'zod/locales';


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
                },
                shouldCache: (req, res) => {
                    // Only cache successful responses (status 200-299)
                    return res.statusCode >= 200 && res.statusCode < 300;
                }
            }),
            EventEmissionMiddleware.forRead('stores_list', {
                extractResourceId: (req) => req.isLandlord ? 'landlord' : (req.tenant?.subdomain || 'unknown'),
                skipCrud: true
            }),
            this.asyncHandler(this.index)
        );
         
        this.router.post("/",
            validateMiddleware.validate(createStoreSchema),
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
        );
        // Get user detail with caching
        this.router.get("/:storeID", 
            validateMiddleware.validate(getStoreSchema),
            CacheMiddleware.cache({
                ttl: 600,
                prefix: 'stores',
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                    return `detail:${context}:${req.params.id}`;
                }
            }),
            EventEmissionMiddleware.forRead('user'),
            this.asyncHandler(this.getStore)
        );
        this.router.put("/:storeID", 
            validateMiddleware.validate(updateStoreSchema),
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000,
                maxRequests: rateLimitConfig.put,
                keyGenerator: (req) => `store:update:${req.ip}:${req.isLandlord ? 'landlord' : req.tenant?.subdomain}`
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
            EventEmissionMiddleware.forUpdate('user'),
            this.asyncHandler(this.update.bind(this))
        );
        this.router.delete('/:storeID',
            validateMiddleware.validate(deleteStoreSchema),
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000,
                maxRequests: rateLimitConfig.delete,
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                    return `store:delete:${req.ip}:${context}`;
                }
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
            CacheMiddleware.invalidate((req) => {
                const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain || 'unknown';
                return [
                    `settings:detail:${req.params.subdomain}:${context}`,
                    `settings:stats:*`,
                    `tenant:detail:*` // Also invalidate tenant cache as settings affect tenant data
                ];
            }),
            this.asyncHandler(this.delete.bind(this))
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
    private  index =  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        
         
        const { 
            page, 
            limit, 
            name, 
            code, 
            mobile,
            status,
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

            if (mobile) {
                filter.mobile = { $regex: mobile, $options: 'i' }; // Case-insensitive search
            }
            if (status) {
                filter.status = { $regex: status, $options: 'i' }; // Case-insensitive search
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
                // Set response status before throwing to ensure proper error handling
                res.status(404);
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
            Logging.error('error', error)
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
        this.validateTenantContext(req);
        const userId = req.userId
        const { name, code, email, mobile} = req.body;
      
        
        try {
            
                // Validation checks
                if(!name || !code){
                    throw new ValidationError("Name and code are required", [
                        !name ? "name: Name is required" : "",
                        !code ? "code: code is required" : ""
                    ].filter(Boolean));
                }

            // Check for existing name
            const isNameTaken = await this.storeService.findAllByKey(req.tenantConnection!,{name:name});
            if(isNameTaken &&  isNameTaken.length > 0){

            
                throw new ConflictError("Name is already in use", "name", name);
            }
            // Check for existing name
            const isCodeTaken = await this.storeService.findAllByKey(req.tenantConnection!,{code:code});
            if(isCodeTaken &&  isCodeTaken.length > 0){

            
                throw new ConflictError("Code is already in use", "code", code);
            }
            const isEmailTaken = await this.storeService.findAllByKey(req.tenantConnection!, {email:email})
            if(isEmailTaken &&  isEmailTaken.length > 0){

            
                throw new ConflictError("Email is already in use", "email", email);
            }
             const isMobileTaken = await this.storeService.findAllByKey(req.tenantConnection!, {mobile:mobile})
            if(isMobileTaken &&  isMobileTaken.length > 0){

            
                throw new ConflictError("Mobile is already in use", "mobile", mobile);
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

    private getStore = async (req: Request, res:Response, next:NextFunction) : Promise<void> =>{
        this.validateTenantContext(req);
        const storeID = req.params.storeID;
        try {
            const store = await this.storeService.findById(req.tenantConnection!, storeID);
            if (!store ) {
                throw new NotFoundError("User not found", "user", storeID);
            }

            responseResult.sendResponse({
                res,
                statusCode:200,
                message:'Store updated successfully',
                data:store
            })
            return;
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
    
            if (isDatabaseError(error)) {
                Logging.error("Database error in user retrieval:", error);
                    errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
                return;
            }
    
            // Log unexpected errors
            Logging.error("Unexpected error in user retrieval:", error);
                errorResponse.sendError({
                res,
                message: "Failed to fetch user",
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
            return;
        }
    }
    /**
     * Update Store 
     */
    private update = async (req: Request, res: Response, next: NextFunction) : Promise<void> =>{
        this.validateTenantContext(req);
        const storeID = req.params.storeID;
        const userID = req.userId;
        const {name, code, mobile, email } = req.body

        try {
            // Validation checks
            if(!name || !code){
                throw new ValidationError("Name and code are required", [
                    !name ? "name: Name is required" : "",
                    !code ? "code: code is required" : ""
                ].filter(Boolean));
            }

            const existingStore = await this.storeService.findById(req.tenantConnection!, storeID);
            if(name != existingStore?.name){
                // Check for existing name
                const isNameTaken = await this.storeService.findAllByKey(req.tenantConnection!,{name:name});
                if(isNameTaken &&  isNameTaken.length > 0){

                
                    throw new ConflictError("Name is already in use", "name", name);
                }
            }
            if(code != existingStore?.code){
                // Check for existing name
                // Check for existing name
                const isCodeTaken = await this.storeService.findAllByKey(req.tenantConnection!,{code:code});
                if(isCodeTaken &&  isCodeTaken.length > 0){

                
                    throw new ConflictError("Code is already in use", "code", code);
                }
            }

            if(email != existingStore?.email){
                 const isEmailTaken = await this.storeService.findAllByKey(req.tenantConnection!, {email:email})
                if(isEmailTaken &&  isEmailTaken.length > 0){

                
                    throw new ConflictError("Email is already in use", "email", email);
                }
            }

            if(mobile != existingStore?.mobile){
                 const isMobileTaken = await this.storeService.findAllByKey(req.tenantConnection!, {mobile:mobile})
                if(isMobileTaken &&  isMobileTaken.length > 0){

                
                    throw new ConflictError("Mobile is already in use", "mobile", mobile);
                }
            }

             const updateStore: Partial<IStore> = {
                name,
                code,
                mobile,
                email,
                updatedBy:userID
                
            }
            const store  = await this.storeService.update(req.tenantConnection!,storeID, updateStore);
            if(!store){
                throw new UpdateFailedError("Could not update store", "stores");
            }

            responseResult.sendResponse({
                res,
                statusCode:200,
                message:'Store updated successfully',
                data:store
            })
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
    

    /**
     * Delete Store
     */
    private delete = async (req: Request, res: Response, next:NextFunction) : Promise<void> =>{
        this.validateTenantContext(req);
         const { storeID } = req.params;
         try {
            const storeToDelete = await this.storeService.findById(req.tenantConnection!, storeID);
             if (!storeToDelete) {
                throw new NotFoundError('Store not found', 'store', storeID);
            }
            const store = await this.storeService.delete(req.tenantConnection!, storeID);
             if (!store) {
                throw new DeletionFailedError(
                    "Failed to delete store", 
                    "store", 
                    storeID, 
                    "store not found or deletion operation failed"
                );
            }

             responseResult.sendResponse({
                res,
                data: null,
                message: 'User deleted successfully',
                statusCode: 200
            });
            return;

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
    }
}

export default new StoreController().router;