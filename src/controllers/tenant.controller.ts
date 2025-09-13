import { Request, Response, NextFunction } from "express";
import { Controller } from "./controller";
import { responseResult } from "../utils/response";
import { errorResponse } from "../utils/errorResponse";
import TenantService from "../services/tenant.service";
import { ITenant } from "../models/tenant.model";
import { log } from "console";
import Logging from "../libraries/logging.library";
import { DateUtils } from "../utils/dateUtils";

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

        const { page, limit, name, subdomain, createdAtFrom, createdAtTo, sortBy, sortOrder, sortField, sortDirection } = req.query;
        
        try {
            // Build filter object based on query parameters
            const filter: any = {};
            
            if (name) {
                filter.name = { $regex: name, $options: 'i' }; // Case-insensitive search
            }
            
            if (subdomain) {
                filter.subdomain = { $regex: subdomain, $options: 'i' }; // Case-insensitive search
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