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
import EventEmissionMiddleware from "../middlewares/eventEmission.middleware";
import { EmitUserCreated, EmitUserUpdated, EmitUserDeleted, EmitUserViewed } from "../decorators/event.decorator";

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
        // Enhanced routes with event middleware
        this.router.get('/:tenantId/users', 
            EventEmissionMiddleware.forRead('user_list', {
                extractResourceId: (req) => req.params.tenantId,
                skipCrud: true // List operations don't need CRUD events
            }),
            this.asyncHandler(this.getUsers.bind(this))
        );
        
        this.router.post('/:tenantId/users', 
            EventEmissionMiddleware.forCreate('user'),
            this.asyncHandler(this.create.bind(this))
        );
        
        this.router.get('/:tenantId/users/:userId', 
            EventEmissionMiddleware.forRead('user'),
            this.asyncHandler(this.getUser.bind(this))
        );
        
        this.router.patch('/:tenantId/users/:userId', 
            EventEmissionMiddleware.forUpdate('user'),
            this.asyncHandler(this.update.bind(this))
        );
        
        this.router.delete('/:tenantId/users/:userId', 
            EventEmissionMiddleware.forDelete('user'),
            this.asyncHandler(this.delete.bind(this))
        );
        
        this.router.patch('/:tenantId/users/:userId/reset-password', 
            EventEmissionMiddleware.createEventMiddleware({
                resource: 'user',
                operation: 'update',
                customEventName: 'user.password.reset'
            }),
            this.asyncHandler(this.passwordReset.bind(this))
        );
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

            // Emit audit event for user list access
            EventService.emitAuditTrail(
                'user_list_accessed',
                'user_list',
                tenantId,
                'system', // or req.userId if available
                {
                    totalUsers: (result as any).total || (result as any).totalCount || result.items?.length || 0,
                    page: Number(page) || 1,
                    limit: Number(limit) || 10,
                    filters: filter
                },
                EventService.createContextFromRequest(req)
            );

           return responseResult.sendResponse({
                res,
                data: {
                    ...result,
                    items: sanitizedTenants
                },
                message: "Users retrieved successfully",
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

            // Emit user created event with comprehensive data
            EventService.emitUserCreated({
                userId: user._id as string,
                email: user.email,
                name: user.name,
                mobile: user.mobile,
                role: user.role,
                tenantId: tenantId as string,
                createdBy: 'admin' // or req.userId if available
            }, EventService.createContextFromRequest(req));

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

        // Emit user viewed event
        EventService.emitUserViewed(
            userId,
            'admin', // or req.userId if available
            EventService.createContextFromRequest(req)
        );

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

        
          

            // Get previous user data for event emission
            const previousUser = await this.userService.findById(connection.connection, userId);
            
            const updatedUser = await this.userService.update(connection.connection, userId, {email: updateData.email, name: updateData.name, mobile: updateData.mobile});
            if (!updatedUser) {
                return errorResponse.sendError({
                    res,
                    message: "User not found or no changes made",
                    statusCode: 404
                });
            }

            // Emit user updated event
            EventService.emitUserUpdated({
                userId: userId,
                previousData: {
                    email: previousUser?.email,
                    name: previousUser?.name,
                    mobile: previousUser?.mobile
                },
                newData: {
                    email: updateData.email,
                    name: updateData.name,
                    mobile: updateData.mobile
                },
                updatedFields: Object.keys(updateData).filter(key => 
                    ['email', 'name', 'mobile'].includes(key) && updateData[key] !== undefined
                ),
                updatedBy: 'admin', // or req.userId if available
                tenantId: tenantId
            }, EventService.createContextFromRequest(req));

            const userAddress = new addressRepository(connection.connection);
            const address = await userAddress.findByUserId(userId);
            
            if (address && (updateData.address || updateData.city || updateData.state || updateData.postalCode)) {
                            // Update existing address and emit event
                            const previousAddressData = {
                                street: address.street,
                                city: address.city,
                                state: address.state,
                                zip: address.zip
                            };
                            
                            await userAddress.update(address._id as string, {
                                street: updateData.address,
                                city: updateData.city,
                                state : updateData.state,
                                zip: updateData.postalCode,
                            });
                            
                            // Emit address updated event
                            EventService.emitAddressUpdated({
                                addressId: address._id as string,
                                userId: updatedUser._id as string,
                                previousData: previousAddressData,
                                newData: {
                                    street: updateData.address,
                                    city: updateData.city,
                                    state: updateData.state,
                                    zip: updateData.postalCode
                                },
                                tenantId: tenantId
                            }, EventService.createContextFromRequest(req));
                        } else if (!address && (updateData.address || updateData.city || updateData.state || updateData.postalCode)) {
                            // Create new address
                            const newAddress: Partial<IAddress> = {
                                userId: updatedUser._id,
                                street: updateData.address,
                                city: updateData.city,
                                state: updateData.state,
                                zip: updateData.postalCode,
                            };
                            const createdAddress = await userAddress.create(newAddress);
                            
                            // Emit address created event
                            EventService.emitAddressCreated({
                                addressId: createdAddress._id as string,
                                userId: updatedUser._id as string,
                                street: updateData.address,
                                city: updateData.city,
                                state: updateData.state,
                                zip: updateData.postalCode,
                                tenantId: tenantId
                            }, EventService.createContextFromRequest(req));
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
            
            // Get user data before deletion for event emission
            const userToDelete = await this.userService.findById(connection.connection, userId);
            if (!userToDelete) {
                return errorResponse.sendError({
                    res,
                    message: "User not found",
                    statusCode: 404
                });
            }
            
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

            // Emit user deleted event
            EventService.emitUserDeleted({
                userId: userId,
                email: userToDelete.email,
                name: userToDelete.name,
                deletedBy: 'admin', // or req.userId if available
                tenantId: tenantId,
                softDelete: false
            }, EventService.createContextFromRequest(req));

            // Emit address deleted event if address existed
            EventService.emitAddressDeleted(
                'address_for_user_' + userId,
                userId,
                EventService.createContextFromRequest(req)
            );

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
            
            // Get user data for event emission
            const userForReset = await this.userService.findById(connection.connection, userId);
            if (!userForReset) {
                return errorResponse.sendError({
                    res,
                    message: "User not found",
                    statusCode: 404
                });
            }
            
            const hashedPassword = await hashPassword(newPassword);
            const updatedUser = await this.userService.update(connection.connection, userId, { password: hashedPassword });
            if (!updatedUser) {
                return errorResponse.sendError({
                    res,
                    message: "User not found or no changes made",
                    statusCode: 404
                });
            }

            // Emit password reset event
            EventService.emitUserPasswordReset({
                userId: userId,
                email: userForReset.email,
                resetBy: 'admin', // or req.userId if available
                tenantId: tenantId,
                resetMethod: 'admin'
            }, EventService.createContextFromRequest(req));

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