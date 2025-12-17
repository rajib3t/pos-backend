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
    deleteMaterialCategorySchema,
    getAllMaterialCategoriesSchema,
    getMaterialCategorySchema,
    updateMaterialCategorySchema,
} from '../../../validators/material-category.validator'
import CacheMiddleware from '../../../middlewares/cache.middleware'
import { rateLimitConfig } from "../../../config";
import EventEmissionMiddleware from '../../../middlewares/eventEmission.middleware'
import { DateUtils } from '../../../utils/dateUtils';
import StoreService from "../../../services/store/store.service";
import { de } from "zod/locales";
class MaterialCategoryController extends Controller{

    private materialService : MaterialCategoryService
    private storeService : StoreService
    private validateMiddleware : ValidateMiddleware
    constructor(){
        super()
        this.materialService = MaterialCategoryService.getInstance()
        this.storeService = StoreService.getInstance()
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
            this.validateMiddleware.validate(getAllMaterialCategoriesSchema),
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
        this.router.get('/:storeID/material-category/:categoryID',
            this.validateMiddleware.validate(getMaterialCategorySchema),
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.get,
                keyGenerator: (req) => `materials-category:get:${req.ip}:${req.isLandlord ? 'landlord' : req.subdomain}`
            }),
            CacheMiddleware.cache({
                ttl: 300,
                prefix: 'materials-category',
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain;
                    const storeID = req.params.storeID || 'anonymous';
                    const categoryID = req.params.categoryID || 'unknown';
                    return `get:${context}:${storeID}:${categoryID}`;
                },
                shouldCache: (req, res) => {
                    // Only cache successful responses (status 200-299)
                    return res.statusCode >= 200 && res.statusCode < 300;
                }
            }),
            EventEmissionMiddleware.forRead('materials-category'),
            this.asyncHandler(this.getById.bind(this))
        )
        this.router.post('/:storeID/material-category/generate-code',
            
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000,
                maxRequests: rateLimitConfig.post,
                keyGenerator: (req) => `materials-category:generate-code:${req.ip}:${req.isLandlord ? 'landlord' : req.subdomain}`
            }),
           
            EventEmissionMiddleware.forRead('materials-category'),
            this.asyncHandler(this.generateCode.bind(this))
        )
        this.router.put('/:storeID/material-category/:categoryID',
            this.validateMiddleware.validate(updateMaterialCategorySchema),
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000,
                maxRequests: rateLimitConfig.put,
                keyGenerator: (req) => `materials-category:update:${req.ip}:${req.isLandlord ? 'landlord' : req.subdomain}`
            }),
            CacheMiddleware.invalidate((req) => {
                const context = req.isLandlord ? 'landlord' : (req.subdomain || 'unknown');
                const storeId = req.params.storeID;
                const categoryId = req.params.categoryID;
                const patterns = [
                    // Invalidate staff list cache (matches keyGenerator pattern)
                    `materials-category:list:${context}:${storeId}:*`,
                    `materials-category:get:${context}:${storeId}:${categoryId}`
                ];
                // Also invalidate landlord style keys using tenantId, if available
                if (!req.isLandlord && req.tenant?._id) {
                    patterns.push(
                        `materials-category:list:landlord:${req.tenant._id}:*`,
                        `materials-category:get:landlord:${req.tenant._id}:${categoryId}`
                    );
                }
                return patterns;
            }), 
            EventEmissionMiddleware.forUpdate('materials-category'),
            this.asyncHandler(this.update.bind(this))
        )
        this.router.delete('/:storeID/material-category/:categoryID',
            this.validateMiddleware.validate(deleteMaterialCategorySchema),
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000,
                maxRequests: rateLimitConfig.delete,
                keyGenerator: (req) => `materials-category:delete:${req.ip}:${req.isLandlord ? 'landlord' : req.subdomain}`
            }),
            CacheMiddleware.invalidate((req) => {
                const context = req.isLandlord ? 'landlord' : (req.subdomain || 'unknown');
                const storeId = req.params.storeID;
                const categoryId = req.params.categoryID;
                const patterns = [
                    // Invalidate staff list cache (matches keyGenerator pattern)
                    `materials-category:list:${context}:${storeId}:*`,
                    `materials-category:get:${context}:${storeId}:${categoryId}`
                ];
                // Also invalidate landlord style keys using tenantId, if available
                if (!req.isLandlord && req.tenant?._id) {
                    patterns.push(
                        `materials-category:list:landlord:${req.tenant._id}:*`,
                        `materials-category:get:landlord:${req.tenant._id}:${categoryId}`
                    );
                }
                return patterns;
            }),
            EventEmissionMiddleware.forDelete('materials-category'),
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
            
            let { name, code } = req.body;
            const userID = req.userId;

            if (!userID) {
                throw new ValidationError("User authentication required", [
                    "userID: User authentication required"
                ]);
            }

            const isNameTaken = await this.materialService.findAllByKey(
                req.tenantConnection!,
                { name, store: storeID} // Exclude current category
            );
            if (isNameTaken && isNameTaken.length > 0) {
                throw new ConflictError("Material category name already exists", "name", name);
            }

            const isCodeTaken = await this.materialService.findAllByKey(
                req.tenantConnection!,
                { code, store: storeID } // Exclude current category
            );
            if (isCodeTaken && isCodeTaken.length > 0) {
                throw new ConflictError("Material category code already exists", "code", code);
            }

            // Fetch store details to get store name for code generation
            const store = await this.storeService.findById(
                req.tenantConnection!,
                storeID
            );

            if (!store) {
                throw new NotFoundError("Store not found", "store", storeID);
            }

            // Auto-generate code if not provided
           

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

            // NotFound errors (for store)
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
                // Determine if we should populate createdBy field
                // Query params come as strings, so check for 'true' or '1'
                const shouldPopulate = populate === 'true' || populate === '1';
                
                // Debug logging
                Logging.info(`Material Category List - Query params:`, req.query);
                Logging.info(`Material Category List - populate param: ${populate} (type: ${typeof populate}), shouldPopulate: ${shouldPopulate}`);

                 // Use the enhanced getUsersWithPagination method
                const result = await this.materialService.getDataWithPagination(req.tenantConnection!, {
                    page: Number(page) || 1,
                    limit: Number(limit) || 10,
                    filter,
                    sort,
                    populate: shouldPopulate ? [
                        {
                            path: 'createdBy',
                            select: 'name email role _id'
                        }
                    ] : undefined
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

    private getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            this.validateTenantContext(req);
            const storeID = req.params.storeID;
            const categoryID = req.params.categoryID;

            const category = await this.materialService.findByKey(
                req.tenantConnection!,
                { _id: categoryID, store: storeID },
            );

            if (!category) {
                        throw new NotFoundError("Material category not found", "material-category", categoryID);
                }

            responseResult.sendResponse({
                res,
                data: category,
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
                Logging.error("Database error in material category retrieval:", error);
                errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
                return;
            }

            // Log unexpected errors
            Logging.error("Unexpected error in material category retrieval:", error);
            errorResponse.sendError({
                res,
                message: "Failed to fetch material category",
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    }


    private update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Implementation for update method goes here
        this.validateTenantContext(req);
        const storeID = req.params.storeID;
        const categoryID = req.params.categoryID;
        const { name, code } = req.body;
        const userID = req.userId;

        if (!userID) {
            throw new ValidationError("User authentication required", [
                "userID: User authentication required"
            ]);
        }

        try {
            const isNameTaken = await this.materialService.findByKey(
                req.tenantConnection!,
                { name, store: storeID, _id: { $ne: categoryID } } // Exclude current category
            );
            if (isNameTaken) {
                throw new ConflictError("Material category name already exists", "name", name);
            }

            const isCodeTaken = await this.materialService.findByKey(
                req.tenantConnection!,
                { code, store: storeID, _id: { $ne: categoryID } } // Exclude current category
            );
            if (isCodeTaken) {
                throw new ConflictError("Material category code already exists", "code", code);
            }

            // Check if the category exists
            const existingCategory = await this.materialService.findByKey(
                req.tenantConnection!,
                { _id: categoryID, store: storeID }
            );

            if (!existingCategory) {
                throw new NotFoundError("Material category not found", "material-category", categoryID);
            }

            // Prepare update data
            const updateData: Partial<IMaterialCategory> = {
                name,
                code,
                updatedBy: userID,
                updatedAt: new Date()
            };

            // Remove undefined fields from updateData
            Object.keys(updateData).forEach(key => {
                if (updateData[key as keyof IMaterialCategory] === undefined) {
                    delete updateData[key as keyof IMaterialCategory];
                }
            });

            // Perform the update
            const updatedCategory = await this.materialService.update(
                req.tenantConnection!,
                categoryID,
                updateData
            );

            if (!updatedCategory) {
                throw new CreationFailedError(
                    "Could not update material category",
                    "material-category"
                );
            }

            responseResult.sendResponse({
                res,
                data: updatedCategory,
                message: 'Material category updated successfully',
                statusCode: 200
            });
            return;

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

            if (error instanceof ConflictError) {
                 errorResponse.sendError({
                    res,
                    message: "Validation failed",
                    statusCode: 409,
                    details: [`${error.conflictField}: ${error.message}`]
                });
                return;
            }

            // NotFound errors (for store)
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

    private generateCode = async (req: Request, res: Response): Promise<void> => {
        const storeID = req.params.storeID; 
            const store = await this.storeService.findById(req.tenantConnection!, storeID as string);
            if (!store) {
                throw new NotFoundError("Store not found for code generation", "store", storeID);
            }

            try {
            const categoryName = req.body.name;

            // Extract first 3 letters from store name and category name, uppercase
            const storePrefix = store?.name
                .replace(/[^a-zA-Z]/g, '') // Remove non-alphabetic characters
                .substring(0, 3)
                .toUpperCase()
                .padEnd(3, 'X'); // Pad with X if less than 3 characters
            
            const categoryPrefix = categoryName
                .replace(/[^a-zA-Z]/g, '') // Remove non-alphabetic characters
                .substring(0, 3)
                .toUpperCase()
                .padEnd(3, 'X'); // Pad with X if less than 3 characters
            
            const baseCode = `${storePrefix}${categoryPrefix}`;
            
            
            // Check if base code exists
            let counter = 1;
            let uniqueCode = `${baseCode}${counter.toString().padStart(3, '0')}`;
            let isUnique = false;
            
            // Keep checking until we find a unique code
            while (!isUnique && counter < 1000) { // Limit to 999 attempts
                const existingCategory = await this.materialService.findByKey(
                    req.tenantConnection!,
                    { code: uniqueCode, store: storeID }
                );
                
                if (!existingCategory) {
                    isUnique = true;
                } else {
                    counter++;
                    uniqueCode = `${baseCode}${counter.toString().padStart(3, '0')}`;
                }
            }
            
            if (!isUnique) {
                throw new Error('Unable to generate unique code after 999 attempts');
            }

            Logging.info(`Generated unique code: ${uniqueCode} for store: ${store?.name}, category: ${categoryName}`);

            responseResult.sendResponse({
                res,
                data: uniqueCode,
                message: 'Unique code generated successfully',
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
             // NotFound errors (for store)
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
                Logging.error("Database error in code generation:", error);
                errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
                return;
            }

             // Log unexpected errors
            Logging.error("Unexpected error in material category retrieval:", error);
            errorResponse.sendError({
                res,
                message: "Failed to fetch material category",
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
            return;
            
        }
    }

    private delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        this.validateTenantContext(req);
        const storeID = req.params.storeID;
        const categoryID = req.params.categoryID;

        try {
            // Check if the category exists
            const existingCategory = await this.materialService.findByKey(
                req.tenantConnection!,
                { _id: categoryID, store: storeID }
            );

            if (!existingCategory) {
                throw new NotFoundError("Material category not found", "material-category", categoryID);
            }

            // Perform the deletion
            const deleted = await this.materialService.delete(
                req.tenantConnection!,
                categoryID
            );

            if (!deleted) {
                throw new CreationFailedError(
                    "Could not delete material category",
                    "material-category"
                );
            }

            responseResult.sendResponse({
                res,
                data: null,
                message: 'Material category deleted successfully',
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
                Logging.error("Database error in material category deletion:", error);
                errorResponse.sendError({
                    res,
                    message: "Database operation failed",
                    statusCode: 500
                });
                return;
            }

            // Log unexpected errors
            Logging.error("Unexpected error in material category deletion:", error);
            errorResponse.sendError({
                res,
                message: "Failed to delete material category",
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }

    }
}

export default new MaterialCategoryController().router;