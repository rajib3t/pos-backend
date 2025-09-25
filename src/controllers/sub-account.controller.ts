import TenantService from "../services/tenant.service";
import { Controller } from "./controller";
import { Request, Response, NextFunction } from "express";
import { responseResult } from '../utils/response';
import { errorResponse } from '../utils/errorResponse';
import {
    NotFoundError
} from '../errors/CustomErrors'
import DataSanitizer from '../utils/sanitizeData'
import { ITenant } from "../models/tenant.model";
class SubAccountController extends Controller{
    private tenantService: TenantService
    constructor(){
        super()
        this.tenantService = TenantService.getInstance()
        this.intRoutes()

    }

    private intRoutes(){
        this.router.get('/subdomain/:subdomain',
            this.asyncHandler(this.index.bind(this))
        )
    }

    private index = async (req: Request, res: Response, next: NextFunction)=>{
        const subdomain = req.params.subdomain

        try {
            const tenant = await this.tenantService.getTenantBySubdomain(subdomain)
             if (!tenant) {
                throw new NotFoundError("No sub account found", "sub-accounts", req.isLandlord ? 'landlord' : req.tenant?._id as string);
            }
            const sanitizedUser = DataSanitizer.sanitizeData<ITenant>(tenant, ['databaseName','databaseUser','databasePassword','createdBy','createdAt','updatedAt']);
            return responseResult.sendResponse({
                res,
                data: sanitizedUser,
                message: "Sub account retrieved successfully",
                statusCode: 200
            });
        } catch (error) {
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
             return errorResponse.sendError({
                res,
                message: "Failed to create user",
                statusCode: 500,
                details: process.env.NODE_ENV === 'development' ? error : undefined
            });
        }
    }


}

export default new SubAccountController().router;