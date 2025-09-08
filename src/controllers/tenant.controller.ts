import { Request, Response, NextFunction } from "express";
import { Controller } from "./controller";
import { responseResult } from "../utils/response";
import { errorResponse } from "../utils/errorResponse";
import TenantService from "../services/tenant.service";
import { ITenant } from "../models/tenant.model";
class TenantController extends Controller{
    private tenantService: TenantService;
    constructor() {
        super()
        this.initializeRoutes();
        this.tenantService = TenantService.getInstance();
    }

    private initializeRoutes() {
        this.router.post("/create", this.asyncHandler(this.create));
    }

    private create = async (req: Request , res: Response, next: NextFunction)=>  {

        const {name, subdomain} = req.body;
        if(!name || !subdomain){
            return errorResponse.sendError({
                res,
                message: "Name and Subdomain are required",
                statusCode: 400
            });
        }
        const isNameTaken = await this.tenantService.checkTenantExists(name);
        if(isNameTaken){
            return errorResponse.sendError({
                res,
                message: "Tenant name is already taken",
                statusCode: 409
            });
        }
        const isAvailable = await this.tenantService.checkSubdomainAvailability(subdomain);
        if(!isAvailable){
            return errorResponse.sendError({
                res,
                message: "Subdomain is already taken",
                statusCode: 409
            });
        }
        try {
            const newTenant: Partial<ITenant> = {
                name,
                subdomain
            }
            const createdTenant = await this.tenantService.registerTenant(newTenant);

            return responseResult.sendResponse({
                res,
                data: createdTenant,
                message: "Tenant created successfully",
                statusCode: 201
            });
        } catch (error) {
            return errorResponse.sendError({
                res,
                message: (error as Error).message || "Internal Server Error",
                statusCode: 500
            });
        }
        

    }
}

export default new TenantController().router;