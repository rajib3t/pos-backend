import { Request,Response, NextFunction } from "express";
import { Controller } from "./controller";
import { responseResult } from "../utils/response";
import { errorResponse } from "../utils/errorResponse";
import  TenantService  from "../services/tenant.service";
import {TenantConnectionService} from "../services/tenantConnection.service";
import Logging from "../libraries/logging.library";
import { DateUtils } from "../utils/dateUtils";
import UserService from "../services/user.service";
import DataSanitizer from "../utils/sanitizeData";
import { IUser } from "../models/user.model";

class TenantUserController extends Controller{
     private tenantService: TenantService;
     private connectionService: TenantConnectionService;
     private userService: UserService;
  
    constructor() {
        super()
        this.initializeRoutes();
        this.tenantService = TenantService.getInstance();
        this.connectionService = TenantConnectionService.getInstance();
        this.userService = UserService.getInstance();
    }

    private initializeRoutes() {
        this.router.get('/:tenantId/users', this.asyncHandler(this.getUsers.bind(this)));
    }

    private getUsers = async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.params.tenantId;
        const { page, limit, name, email, createdAtFrom, createdAtTo, sortBy, sortOrder, sortField, sortDirection } = req.query;
        if (!tenantId) {
           return errorResponse.sendError({
                res,
                message: "Tenant ID is required",
                statusCode: 400
            });

        }

        try {

            const tenant = await this.tenantService.findById(tenantId);
            if (!tenant) {
                return errorResponse.sendError({
                    res,
                    message: "Tenant not found",
                    statusCode: 404
                });
            }

            // Build filter object based on query parameters
            const filter: any = {};
            
            if (name) {
                filter.name = { $regex: name, $options: 'i' }; // Case-insensitive search
            }

            if (email) {
                filter.email = { $regex: email, $options: 'i' }; // Case-insensitive search
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

            // create a connection to the tenant's database

            const connection = await this.connectionService.getTenantConnection(tenant.subdomain);
             const result = await this.userService.getUsersWithPagination(connection.connection, {
                page: Number(page) || 1,
                limit: Number(limit) || 10,
                filter,
                sort
            });

           await this.connectionService.closeAllConnections();
            
            if (!result) {

                return errorResponse.sendError({
                    res,
                    message: "Failed to fetch users",
                    statusCode: 404
                });

            }
            // Sanitize the tenant data to remove sensitive fields
            const sanitizedTenants = DataSanitizer.sanitizeData<IUser[]>(result.items, ['password']);

           return responseResult.sendResponse({
                res,
                data: {
                    ...result,
                    items: sanitizedTenants
                },
                message: "Tenants retrieved successfully",
                statusCode: 200
            });
            // Sanitize the tenant data to remove sensitive fields
           

            
        }catch (error) {
            Logging.info("Error fetching users:", error);
            return errorResponse.sendError({
                res,
                message: "Failed to fetch users",
                statusCode: 500,
                details: error
            });
        }

    }



}



export default new TenantUserController().router;