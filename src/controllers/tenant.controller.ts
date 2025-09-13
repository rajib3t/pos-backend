import { Request, Response, NextFunction } from "express";
import { Controller } from "./controller";
import { responseResult } from "../utils/response";
import { errorResponse } from "../utils/errorResponse";
import TenantService from "../services/tenant.service";
import { ITenant } from "../models/tenant.model";
import { log } from "console";
import Logging from "../libraries/logging.library";
class TenantController extends Controller{
    private tenantService: TenantService;
    constructor() {
        super()
        this.initializeRoutes();
        this.tenantService = TenantService.getInstance();
    }

    private initializeRoutes() {
        this.router.post("/create", this.asyncHandler(this.create));
        this.router.get("/", this.asyncHandler(this.index));
    }

    // Utility method to remove sensitive fields from tenant data
    private sanitizeTenantData(tenant: ITenant | ITenant[]) {
        if (Array.isArray(tenant)) {
            return tenant.map(t => {
                const { databasePassword, ...sanitized } = t.toObject ? t.toObject() : t;
                return sanitized;
            });
        } else {
            const { databasePassword, ...sanitized } = tenant.toObject ? tenant.toObject() : tenant;
            return sanitized;
        }
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
            const sanitizedTenant = this.sanitizeTenantData(createdTenant);

            return responseResult.sendResponse({
                res,
                data: sanitizedTenant,
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

    private index = async (req: Request , res: Response, next: NextFunction)=>  {

        const { page, limit, name, subdomain, createdAtFrom, createdAtTo, sortBy, sortOrder } = req.query;
        
        try {
            // Build filter object based on query parameters
            const filter: any = {};
            
            if (name) {
                filter.name = { $regex: name, $options: 'i' }; // Case-insensitive search
            }
            
            if (subdomain) {
                filter.subdomain = { $regex: subdomain, $options: 'i' }; // Case-insensitive search
            }
            
            // Date range filtering
            if (createdAtFrom || createdAtTo) {
                filter.createdAt = {};
                if (createdAtFrom) {
                    filter.createdAt.$gte = new Date(createdAtFrom as string);
                }
                if (createdAtTo) {
                    // Add time to end of day for "to" date
                    const toDate = new Date(createdAtTo as string);
                    toDate.setHours(23, 59, 59, 999);
                    filter.createdAt.$lte = toDate;
                }
            }

            // Build sort object
            const sort: any = {};
            if (sortBy) {
                const order = sortOrder === 'asc' ? 1 : -1;
                sort[sortBy as string] = order;
            } else {
                sort.createdAt = -1; // Default sort by creation date descending
            }

            Logging.info(`Fetching tenants with filters: ${JSON.stringify(filter)} and sort: ${JSON.stringify(sort)}`);
            const result = await this.tenantService.getTenantsWithPagination({
                page: Number(page) || 1,
                limit: Number(limit) || 10,
                filter,
                sort
            });

            // Sanitize the tenant data to remove sensitive fields
            const sanitizedTenants = this.sanitizeTenantData(result.items);

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
            return errorResponse.sendError({
                res,
                message: (error as Error).message || "Internal Server Error",
                statusCode: 500
            });
        }
    }
}

export default new TenantController().router;