import { Request, Response, NextFunction } from "express";
import { Controller } from "../../controller";
import {
    isDatabaseError,
    ConflictError,
    isValidationError,
    isCreationFailedError,
    ValidationError,
    CreationFailedError,
    NotFoundError
} from '../../../errors/CustomErrors'
import {errorResponse} from '../../../utils/errorResponse'
import {responseResult} from '../../../utils/response'
import Logging from "../../../libraries/logging.library";
import MaterialCategoryService from "../../../services/materials/material-category.service";
import { IMaterialCategory } from "../../../models/materials/material-category.model";
import ValidateMiddleware from '../../../middlewares/validate';
import {
    createMaterialCategorySchema,
} from '../../../validators/material-category.validator'
import CacheMiddleware from '../../../middlewares/cache.middleware'
import { rateLimitConfig } from "../../../config";
import EventEmissionMiddleware from '../../../middlewares/eventEmission.middleware'
import { DateUtils } from '../../../utils/dateUtils';
class MaterialCategoryController extends Controller{

    private materialService : MaterialCategoryService
    private validateMiddleware : ValidateMiddleware
    constructor(){
        super()
        this.materialService = MaterialCategoryService.getInstance()
        this.validateMiddleware = ValidateMiddleware.getInstance()
        this.initRoutes()
    }

    private initRoutes(){
        this.router.post('/:storeID/material-category', 
            this.validateMiddleware.validate(createMaterialCategorySchema),
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000,
                maxRequests: rateLimitConfig.post,
                keyGenerator: (req) => `materials-category:create:${req.ip}:${req.isLandlord ? 'landlord' : req.subdomain}`
            }),
            CacheMiddleware.invalidate((req) => {
                const context = req.isLandlord ? 'landlord' : (req.subdomain || 'unknown');
                const storeId = req.params.storeID;
                const patterns = [
                    // Invalidate staff list cache (matches keyGenerator pattern)
                    `materials-category:list:${context}:${storeId}:*`,
                    
                ];
                // Also invalidate landlord style keys using tenantId, if available
                if (!req.isLandlord && req.tenant?._id) {
                    patterns.push(
                        `materials-category:list:${context}:${storeId}:*`,
                    );
                }
                return patterns;
            }),
            EventEmissionMiddleware.forCreate('materials-category'),
            this.asyncHandler(this.create.bind(this))
        )
        this.router.get('/:storeID/material-category',
           CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.get,
                keyGenerator: (req) => `materials-category:list:${req.ip}:${req.isLandlord ? 'landlord' : req.subdomain}`
            }),
            
            CacheMiddleware.cache({
                ttl: 300,
                prefix: 'materials-category',
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                    const storeID = req.params.storeID || 'anonymous';
                    const queryStr = JSON.stringify(req.query || {});
                    return `list:${context}:${storeID}:${Buffer.from(queryStr).toString('base64')}`;
                },
               
                shouldCache: (req, res) => {
                    // Only cache successful responses (status 200-299)
                    return res.statusCode >= 200 && res.statusCode < 300;
                }
            }),
            EventEmissionMiddleware.forUpdate('materials-category'),
            this.asyncHandler(this.index.bind(this))
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
    private getContextInfo(req: Request): string {
        if (req.isLandlord) {
            return 'landlord (main database)';
        }
        return `tenant ${req.tenant?.subdomain}`;
    }

    private create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            this.validateTenantContext(req);
            const storeID = req.params.storeID;
            
            const { name, code } = req.body;
            const userID = req.userId;

            if (!userID) {
                throw new ValidationError("User authentication required", [
                    "userID: User authentication required"
                ]);
            }

            const newCategory: Partial<IMaterialCategory> = {
                name,
                code,
                store: storeID,
                createdBy: userID
            };

            try {
                const category = await this.materialService.create(
                    req.tenantConnection!, 
                    newCategory
                );
                
                if (!category) {
                    throw new CreationFailedError(
                        "Could not create material category",
                        "material-category"
                    );
                }

                responseResult.sendResponse({
                    res,
                    data: category,
                    message: 'Material category created successfully',
                    statusCode: 201
                });
                return;

            } catch (dbError: any) {
                Logging.error('Database operation error:', dbError);
                
                // Check for MongoDB duplicate key error (code 11000)
                if (dbError.code === 11000) {
                    const keyPattern = dbError.keyPattern || {};
                    const keyValue = dbError.keyValue || {};
                    
                    // Determine which field caused the conflict
                    let field = Object.keys(keyPattern)[0];
                    let value = keyValue[field];
                    
                    // Handle compound index errors
                    if (keyPattern.name && keyPattern.store) {
                        field = 'name';
                        value = keyValue.name;
                    } else if (keyPattern.code && keyPattern.store) {
                        field = 'code';
                        value = keyValue.code;
                    }
                    
                    // Construct proper error message (matching your other usage)
                    const fieldCapitalized = field.charAt(0).toUpperCase() + field.slice(1);
                    Logging.error('error1', fieldCapitalized)
                    throw new ConflictError(
                        `${fieldCapitalized} is already in use`,
                        field,
                        value
                    );
                }
                
                // Check if error message contains E11000 (wrapped error)
                if (dbError.message && dbError.message.includes('E11000 duplicate key')) {
                    // Parse the error message to extract field info
                    const match = dbError.message.match(/index: (\w+)_\d+.*dup key: { (\w+): "([^"]+)" }/);
                    if (match) {
                        const field = match[2];
                        const value = match[3];
                        const fieldCapitalized = field.charAt(0).toUpperCase() + field.slice(1);
                        throw new ConflictError(
                            `${fieldCapitalized} is already in use`,
                            field,
                            value
                        );
                    }
                    
                    // Fallback for compound index
                    const compoundMatch = dbError.message.match(/dup key: \{ ([^:]+): "([^"]+)", ([^:]+): "([^"]+)" \}/);
                    if (compoundMatch) {
                        const field1 = compoundMatch[1];
                        const value1 = compoundMatch[2];
                        const fieldCapitalized = field1.charAt(0).toUpperCase() + field1.slice(1);
                         Logging.error('error1', fieldCapitalized)
                        throw new ConflictError(
                            `${fieldCapitalized} is already in use`,
                            field1,
                            value1
                        );
                    }
                }
                Logging.error('error','return')
                throw dbError;
            }
            
        } catch (error: any) {
            // Validation errors
            if (isValidationError(error)) {
                errorResponse.sendError({
                    res,
                    message: error.message,
                    statusCode: 400,
                    details: error.details
                });
                return;
            }

            // Conflict errors
            if (error instanceof ConflictError) {
                errorResponse.sendError({
                    res,
                    message: "Validation failed",
                    statusCode: 409,
                    details: [`${error.conflictField}: ${error.message}`]
                });
                return;
            }

            // Creation failed errors
            if (isCreationFailedError(error)) {
                Logging.warn("Material category creation failed:", error);
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
                return;
            }

            // Database errors
            if (isDatabaseError(error)) {
                Logging.error("Database error in material category creation:", error);
                errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
                return;
            }

            // Unexpected errors
            Logging.error("Unexpected error in material category creation:", {
                error: error.message,
                stack: error.stack,
                storeID: req.params.storeID,
                userID: req.userId
            });
            
            errorResponse.sendError({
                res,
                message: "Failed to create material category",
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? {
                    error: error.message,
                    stack: error.stack
                } : undefined
            });
            return;
        }
    }

    private index = async (req : Request, res: Response, next: NextFunction) : Promise<void> =>{
        this.validateTenantContext(req)
        const storeID = req.params.storeID
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
        } = req.query;

        try {
            // Build base filter
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

                filter.store = storeID


                 // Use the enhanced getUsersWithPagination method
                const result = await this.materialService.getDataWithPagination(req.tenantConnection!, {
                    page: Number(page) || 1,
                    limit: Number(limit) || 10,
                    filter,
                    sort
                });
                if (!result) {
                    throw new NotFoundError("No Material category  found", "material-category", req.isLandlord ? 'landlord' : req.tenant?._id as string);
                }
                responseResult.sendResponse({
                    res,
                    data: result,
                    message: 'Material category retrieved successfully',
                    statusCode: 200
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
}

export default new MaterialCategoryController().router;