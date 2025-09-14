import { Request, Response, NextFunction } from "express";
import { Controller } from "./controller";
import { responseResult } from "../utils/response";
import { errorResponse } from "../utils/errorResponse";
import TenantService from "../services/tenant.service";
import { ITenant } from "../models/tenant.model";
import { log } from "console";
import Logging from "../libraries/logging.library";
import { DateUtils } from "../utils/dateUtils";
import ValidateMiddleware from "../middlewares/validate";
import { tenantCreateSchema , getTenantsSchema, getTenantSchema, updateTenantSchema, deleteTenantSchema} from "../validators/tenant.validator";
import DataSanitizer from "../utils/sanitizeData";
import { th } from "zod/locales";
class TenantController extends Controller{
    private tenantService: TenantService;
    constructor() {
        super()
        this.initializeRoutes();
        this.tenantService = TenantService.getInstance();
    }

    private initializeRoutes() {
        this.router.post("/create", ValidateMiddleware.getInstance().validate(tenantCreateSchema), this.asyncHandler(this.create));
        this.router.get("/", ValidateMiddleware.getInstance().validate(getTenantsSchema), this.asyncHandler(this.index));
        this.router.get("/:id", ValidateMiddleware.getInstance().validate(getTenantSchema), this.asyncHandler(this.getTenant));
        this.router.put("/:id", ValidateMiddleware.getInstance().validate(updateTenantSchema), this.asyncHandler(this.update));
        this.router.delete("/:id", ValidateMiddleware.getInstance().validate(deleteTenantSchema), this.asyncHandler(this.delete));
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
                message: "Validation failed",
                statusCode: 409,
                details: ["name: Name is already in use"],
            });
        }
        const isAvailable = await this.tenantService.checkSubdomainAvailability(subdomain);
        if(!isAvailable){
            return errorResponse.sendError({
                res,
                message: "Validation failed",
                statusCode: 409,
                details: ["subdomain: Subdomain is already in use"],
            });
        }
        try {
            const newTenant: Partial<ITenant> = {
                name,
                subdomain
            }
            const createdTenant = await this.tenantService.registerTenant(newTenant);
            const sanitizedTenant = DataSanitizer.sanitizeData<ITenant>(createdTenant, ['databasePassword']);

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

            
            const result = await this.tenantService.getTenantsWithPagination({
                page: Number(page) || 1,
                limit: Number(limit) || 10,
                filter,
                sort
            });

            // Sanitize the tenant data to remove sensitive fields
            const sanitizedTenants = DataSanitizer.sanitizeData<ITenant[]>(result.items, ['databasePassword']);

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


    private getTenant = async (req: Request , res: Response, next: NextFunction)=>  {
        const { id } = req.params;
        if(!id){
            return errorResponse.sendError({
                res,
                message: "Tenant ID is required",
                statusCode: 400
            });
        }
        try {
            const tenant = await this.tenantService.findById(id);
            if(!tenant){
                return errorResponse.sendError({
                    res,
                    message: "Tenant not found",
                    statusCode: 404
                });
            }
            const sanitizedTenant = DataSanitizer.sanitizeData<ITenant>(tenant, ['databasePassword','__v','createdAt','updatedAt', 'databaseUser','databaseName']);
            return responseResult.sendResponse({
                res,
                data: sanitizedTenant,
                message: "Tenant retrieved successfully",
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

    private update = async (req: Request , res: Response, next: NextFunction)=>  {
        const { id } = req.params;
        const {name, subdomain} = req.body;
        if(!id){
            return errorResponse.sendError({
                res,
                message: "Tenant ID is required",
                statusCode: 400
            });
        }
        if(!name || !subdomain){
            return errorResponse.sendError({
                res,
                message: "Name and Subdomain are required",
                statusCode: 400
            });
        }
        const existingTenant = await this.tenantService.findById(id);
        if(!existingTenant){
            return errorResponse.sendError({
                res,
                message: "Tenant not found",
                statusCode: 404
            });
        }
        if(existingTenant.name !== name){
            const isNameTaken = await this.tenantService.checkTenantExists(name);
            if(isNameTaken){
                return errorResponse.sendError({
                    res,
                    message: "Validation failed",
                    statusCode: 409,
                    details: ["name: Name is already in use"],
                });
            }
        }
        if(existingTenant.subdomain !== subdomain){
            const isAvailable = await this.tenantService.checkSubdomainAvailability(subdomain);
            if(!isAvailable){
                return errorResponse.sendError({
                    res,
                    message: "Validation failed",
                    statusCode: 409,
                    details: ["subdomain: Subdomain is already in use"],
                });
            }
        }
        

        try {
            const updatedTenant = await this.tenantService.update(id, { name, subdomain });
            const sanitizedTenant = DataSanitizer.sanitizeData<ITenant>(updatedTenant, ['databasePassword']);
            return responseResult.sendResponse({
                res,
                data: sanitizedTenant,
                message: "Tenant updated successfully",
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


    private delete = async (req: Request , res: Response, next: NextFunction)=>  {
        const { id } = req.params;
        if(!id){
            return errorResponse.sendError({
                res,
                message: "Tenant ID is required",
                statusCode: 400
            });
        }
        try {
            const existingTenant = await this.tenantService.findById(id);
            if(!existingTenant){
                return errorResponse.sendError({
                    res,
                    message: "Tenant not found",
                    statusCode: 404
                });
            }
            const deletedCount = await this.tenantService.deleteTenant(id);
            return responseResult.sendResponse({
                res,
                data: { deletedCount },
                message: "Tenant deleted successfully",
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