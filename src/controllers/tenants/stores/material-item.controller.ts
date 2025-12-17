import MaterialCategoryService from "../../../services/materials/material-category.service";
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

class MaterialItemController extends Controller {


    private materialItemRepository : MaterialCategoryService;
    constructor() {
        super();
        this.materialItemRepository = MaterialCategoryService.getInstance();
    }

    private initRoutes() {

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

    private create = async (req: Request, res: Response, next: NextFunction) : Promise<void> =>  {
        this.validateTenantContext(req);
        const userId = req.userId;
        const storeID = req.params.storeId;
        const {name, code, category, stock, purchaseUnit, lowStockWarning} = req.body;
        try {
           const isNameTaken = await this.materialItemRepository.findAllByKey(req.tenantConnection!, { name: name });
           if (isNameTaken && isNameTaken.length > 0) {
            throw new ConflictError('Material item name already exists');
           }

           const isCodeTaken = await this.materialItemRepository.findAllByKey(req.tenantConnection!, { code: code });
           if (isCodeTaken && isCodeTaken.length > 0) {
            throw new ConflictError('Material item code already exists');
           }

           const newMaterialItem = await this.materialItemRepository.create(req.tenantConnection!, {
            name,
            code,
            category,
            stock,
            purchaseUnit,
            lowStockWarning,
            store: storeID,
            createdBy: userId
           });
        } catch (error : any) {
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

}

export default new MaterialItemController().router;