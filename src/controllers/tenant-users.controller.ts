import e, { Request,Response, NextFunction } from "express";
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
import { hashPassword } from "../utils/passwords";
import EventService from "../events/EventService";
import addressRepository from "../repositories/address.repository";
import { IAddress } from "@/models/address.model";

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
        this.router.post('/:tenantId/users', this.asyncHandler(this.create.bind(this)));
        this.router.get('/:tenantId/users/:userId', this.asyncHandler(this.getUser.bind(this)));
        this.router.patch('/:tenantId/users/:userId', this.asyncHandler(this.update.bind(this)));
        this.router.delete('/:tenantId/users/:userId', this.asyncHandler(this.delete.bind(this)));
        this.router.patch('/:tenantId/users/:userId/reset-password', this.asyncHandler(this.passwordReset.bind(this)));
    }

    private getUsers = async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.params.tenantId;
        const { page, limit, name, email, mobile, role, status, createdAtFrom, createdAtTo, sortBy, sortOrder, sortField, sortDirection } = req.query;
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

            if (mobile) {
                filter.mobile = { $regex: mobile, $options: 'i' }; // Case-insensitive search
            }

            if (role) {
                filter.role = role;
            }

            if (status !== undefined) {
                filter.status = status === 'true'; // Convert to boolean
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


    private create = async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.params.tenantId;
        const userData = req.body;
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
            const connection = await this.connectionService.getTenantConnection(tenant.subdomain);
            // create a connection to the tenant's database
            const existingUser = await this.userService.findByEmail(connection.connection, userData.email);
            if (existingUser) {
                return errorResponse.sendError({
                    res,
                    message: "Validation failed",
                    statusCode: 409,
                    details: ["email: Email is already in use"],
                });
            }

            const existingUserByMobile = await this.userService.findByMobile(connection.connection, userData.mobile);
            if (existingUserByMobile) {
                return errorResponse.sendError({
                    res,
                    message: "Validation failed",
                    statusCode: 409,
                    details: ["mobile: Mobile number is already in use"],
                });
            }
            const hashedPassword = await hashPassword(userData.password);
            const user = await this.userService.create(connection.connection, { ...userData, password: hashedPassword });
            if (!user) {
                return errorResponse.sendError({
                    res,
                    message: "Failed to create user",
                    statusCode: 500
                });
            }

            // Sanitize the user data to remove sensitive fields
            const sanitizedUser = DataSanitizer.sanitizeData<IUser>(user, ['password']);
              return responseResult.sendResponse({  
                res,
                data: sanitizedUser,
                message: "User created successfully",
                statusCode: 201
            });
        } catch (error) {
            Logging.error("Error creating user:", error);
            return errorResponse.sendError({
                res,
                message: "Failed to create user",
                statusCode: 500,
                details: error
            });
        }
    }


    private getUser = async (req: Request, res: Response, next: NextFunction) => {
    const tenantId = req.params.tenantId;
    const userId = req.params.userId;
    
    if (!tenantId || !userId) {
        return errorResponse.sendError({
            res,
            message: "Tenant ID and User ID are required",
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

        // Create a connection to the tenant's database
        const connection = await this.connectionService.getTenantConnection(tenant.subdomain);
        
        // Use the corrected findById method with proper populate options
        const user = await this.userService.findById(connection.connection, userId);
         const userAddress = new addressRepository(connection.connection);
        const address = await userAddress.findByUserId(userId);
        if (!user) {
            return errorResponse.sendError({
                res,
                message: "User not found",
                statusCode: 404
            });
        }

        // Sanitize the user data to remove sensitive fields
        const sanitizedUser = DataSanitizer.sanitizeData<IUser>(user, ['password']);
        
        return responseResult.sendResponse({
            res,
            data: {...sanitizedUser, address: address ? {
                street: address.street,
                city: address.city,
                state: address.state,
                zip: address.zip
            } : null},
            message: "User retrieved successfully",
            statusCode: 200
        });
    } catch (error) {
        Logging.info("Error fetching user:", error);
        return errorResponse.sendError({
            res,
            message: "Failed to fetch user",
            statusCode: 500,
            details: error
        });
    }   
    }

    private update = async (req: Request, res: Response, next: NextFunction) => {
        // Implementation for updating a user
        const tenantId = req.params.tenantId;
        const userId = req.params.userId;
        const updateData = req.body;

        if (!tenantId || !userId) {
            return errorResponse.sendError({
                res,
                message: "Tenant ID and User ID are required",
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

            // Create a connection to the tenant's database
            const connection = await this.connectionService.getTenantConnection(tenant.subdomain);
            // Check for email uniqueness (exclude current user)
            if (updateData.email) {
                const existingUser = await this.userService.findByEmail(connection.connection, updateData.email);
                
                if (existingUser && String(existingUser._id) !== userId) {
                  
                    return errorResponse.sendError({
                        res,
                        message: "Validation failed",
                        statusCode: 409,
                        details: ["email: Email is already in use"],
                    });
                }
            }
            // Check for mobile uniqueness (exclude current user)
            if (updateData.mobile) {
                const existingUserByMobile = await this.userService.findByMobile(connection.connection, updateData.mobile);
               
                if (existingUserByMobile && String(existingUserByMobile._id) !== userId) {
                   
                    return errorResponse.sendError({
                        res,
                        message: "Validation failed",
                        statusCode: 409,
                        details: ["mobile: Mobile number is already in use"],
                    });
                }
            }

        
          

            const updatedUser = await this.userService.update(connection.connection, userId, {email: updateData.email, name: updateData.name, mobile: updateData.mobile});
            if (!updatedUser) {
                return errorResponse.sendError({
                    res,
                    message: "User not found or no changes made",
                    statusCode: 404
                });
            }

            const userAddress = new addressRepository(connection.connection);
            const address = await userAddress.findByUserId(userId);
            
            if (address) {
                            // Update existing address
                            await userAddress.update(address?._id as string, {
                                street: updateData.address,
                                city: updateData.city,
                                state : updateData.state,
                                zip: updateData.postalCode,
                            });
                        } else {
                            // Create new address
                            const newAddress: Partial<IAddress> = {
                                userId: updatedUser._id,
                                street: updateData.address,
                                city: updateData.city,
                                state: updateData.state,
                                zip: updateData.postalCode,
                            };
                            await userAddress.create(newAddress);
                        }
                
            
            // Sanitize the user data to remove sensitive fields
            const sanitizedUser = DataSanitizer.sanitizeData<IUser>(updatedUser, ['password']);
            const updatedAddress = await userAddress.findByUserId(userId as string);
            return responseResult.sendResponse({
                res,
                data: {...sanitizedUser, address: updatedAddress ? {
                    street: updatedAddress.street,
                    city: updatedAddress.city,
                    state: updatedAddress.state,
                    zip: updatedAddress.zip
                } : null},
                message: "User updated successfully",
                statusCode: 200
            });
        } catch (error) {
            Logging.error("Error updating user:", error);
            return errorResponse.sendError({
                res,
                message: "Failed to update user",
                statusCode: 500,
                details: error
            });
        }

           
    }

    private delete = async (req: Request, res: Response, next: NextFunction) => {
        // Implementation for deleting a user
        const tenantId = req.params.tenantId;
        const userId = req.params.userId;

        if (!tenantId || !userId) {
            return errorResponse.sendError({
                res,
                message: "Tenant ID and User ID are required",
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

            // Create a connection to the tenant's database
            const connection = await this.connectionService.getTenantConnection(tenant.subdomain);
            const userAddress = new addressRepository(connection.connection);
            await userAddress.deleteByUserId(userId);
            const deletedUser = await this.userService.delete(connection.connection, userId);
            if (!deletedUser) {
                return errorResponse.sendError({
                    res,
                    message: "User not found",
                    statusCode: 404
                });
            }

            return responseResult.sendResponse({
                res,
                message: "User deleted successfully",
                statusCode: 200
            });
        } catch (error) {
            Logging.error("Error deleting user:", error);
            return errorResponse.sendError({
                res,
                message: "Failed to delete user",
                statusCode: 500,
                details: error
            });
        }
    }

    private passwordReset = async (req: Request, res: Response, next: NextFunction) => {
        const tenantId = req.params.tenantId;
        const userId = req.params.userId;
        const { newPassword } = req.body;

        if (!tenantId || !userId || !newPassword) {
            return errorResponse.sendError({
                res,
                message: "Tenant ID, User ID, and new password are required",
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

            // Create a connection to the tenant's database
            const connection = await this.connectionService.getTenantConnection(tenant.subdomain);
            const hashedPassword = await hashPassword(newPassword);
            const updatedUser = await this.userService.update(connection.connection, userId, { password: hashedPassword });
            if (!updatedUser) {
                return errorResponse.sendError({
                    res,
                    message: "User not found or no changes made",
                    statusCode: 404
                });
            }

            // Sanitize the user data to remove sensitive fields
            const sanitizedUser = DataSanitizer.sanitizeData<IUser>(updatedUser, ['password']);
            return responseResult.sendResponse({
                res,
                data: sanitizedUser,
                message: "Password updated successfully",
                statusCode: 200
            });
        } catch (error) {
            Logging.error("Error updating password:", error);
            return errorResponse.sendError({
                res,
                message: "Failed to update password",
                statusCode: 500,
                details: error
            });
        }
    }

}



export default new TenantUserController().router;