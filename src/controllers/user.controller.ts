import { Request, Response, NextFunction } from 'express';
import { Controller } from './controller';
import { responseResult } from '../utils/response';
import { errorResponse } from '../utils/errorResponse';
import UserService from '../services/user.service';
import { IUser } from '../models/user.model';
import Logging from '../libraries/logging.library';

class UserController extends Controller {
    private userService: UserService;

    constructor() {
        super();
        this.userService = UserService.getInstance();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.post("/", this.asyncHandler(this.createUser));
        this.router.get("/", this.asyncHandler(this.getUsers));
        this.router.get("/:id", this.asyncHandler(this.getUserById));
        this.router.put("/:id", this.asyncHandler(this.updateUser));
        this.router.delete("/:id", this.asyncHandler(this.deleteUser));
        this.router.patch("/:id/deactivate", this.asyncHandler(this.deactivateUser));
        this.router.get("/search/:term", this.asyncHandler(this.searchUsers));
        this.router.get("/stats/count", this.asyncHandler(this.getUserStats));
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

    /**
     * Create a new user in tenant's database or main database (landlord)
     */
    private createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            this.validateTenantContext(req);
            
            const { name, email, mobile, password } = req.body;

            if (!name || !email || !password) {
                errorResponse.sendError({
                    res,
                    message: 'Name, email, and password are required',
                    statusCode: 400
                });
                return;
            }

            const userData: Partial<IUser> = { name, email, mobile, password };
            let user: IUser;

            if (req.isLandlord) {
                // Landlord request - use main database
                user = await this.userService.create(userData);
            } else {
                // Tenant request - use tenant database
                user = await this.userService.create(req.tenantConnection!, userData);
            }

            // Remove password from response
            const userResponse = { ...user.toObject(), password: undefined };

            responseResult.sendResponse({
                res,
                data: userResponse,
                message: 'User created successfully',
                statusCode: 201
            });

            Logging.info(`User created in ${this.getContextInfo(req)}: ${email}`);
        } catch (error) {
            errorResponse.sendError({
                res,
                message: (error as Error).message || 'Failed to create user',
                statusCode: 500
            });
        }
    };

    /**
     * Get users with pagination (landlord or tenant)
     */
    private getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            this.validateTenantContext(req);
            
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const result = await this.userService.findAllLandlordAware(
                req.tenantConnection!, 
                req.isLandlord || false, 
                page, 
                limit
            );

            // Remove passwords from response
            const usersResponse = {
                ...result,
                data: result.data.map((user: any) => ({ ...user.toObject(), password: undefined }))
            };

            responseResult.sendResponse({
                res,
                data: usersResponse,
                message: 'Users retrieved successfully',
                statusCode: 200
            });
        } catch (error) {
            errorResponse.sendError({
                res,
                message: (error as Error).message || 'Failed to retrieve users',
                statusCode: 500
            });
        }
    };

    /**
     * Get user by ID (landlord or tenant)
     */
    private getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            this.validateTenantContext(req);
            
            const { id } = req.params;
            let user: IUser | null;

            if (req.isLandlord) {
                user = await this.userService.findById(id);
            } else {
                user = await this.userService.findById(req.tenantConnection!, id);
            }

            if (!user) {
                errorResponse.sendError({
                    res,
                    message: 'User not found',
                    statusCode: 404
                });
                return;
            }

            // Remove password from response
            const userResponse = { ...user.toObject(), password: undefined };

            responseResult.sendResponse({
                res,
                data: userResponse,
                message: 'User retrieved successfully',
                statusCode: 200
            });
        } catch (error) {
            errorResponse.sendError({
                res,
                message: (error as Error).message || 'Failed to retrieve user',
                statusCode: 500
            });
        }
    };

    /**
     * Update user (landlord or tenant)
     */
    private updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            this.validateTenantContext(req);
            
            const { id } = req.params;
            const updateData = req.body;

            // Remove password from update data (should be handled separately)
            delete updateData.password;

            let user: IUser | null;

            if (req.isLandlord) {
                user = await this.userService.update(id, updateData);
            } else {
                user = await this.userService.update(req.tenantConnection!, id, updateData);
            }

            if (!user) {
                errorResponse.sendError({
                    res,
                    message: 'User not found',
                    statusCode: 404
                });
                return;
            }

            // Remove password from response
            const userResponse = { ...user.toObject(), password: undefined };

            responseResult.sendResponse({
                res,
                data: userResponse,
                message: 'User updated successfully',
                statusCode: 200
            });

            Logging.info(`User updated in ${this.getContextInfo(req)}: ${user.email}`);
        } catch (error) {
            errorResponse.sendError({
                res,
                message: (error as Error).message || 'Failed to update user',
                statusCode: 500
            });
        }
    };

    /**
     * Delete user (landlord or tenant)
     */
    private deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            this.validateTenantContext(req);
            
            const { id } = req.params;
            let user: IUser | null;

            if (req.isLandlord) {
                user = await this.userService.delete(id);
            } else {
                user = await this.userService.delete(req.tenantConnection!, id);
            }

            if (!user) {
                errorResponse.sendError({
                    res,
                    message: 'User not found',
                    statusCode: 404
                });
                return;
            }

            responseResult.sendResponse({
                res,
                data: null,
                message: 'User deleted successfully',
                statusCode: 200
            });

            Logging.info(`User deleted in ${this.getContextInfo(req)}: ${user.email}`);
        } catch (error) {
            errorResponse.sendError({
                res,
                message: (error as Error).message || 'Failed to delete user',
                statusCode: 500
            });
        }
    };

    /**
     * Deactivate user
     */
    private deactivateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            this.validateTenantContext(req);
            
            const { id } = req.params;
            const user = await this.userService.deactivate(req.tenantConnection!, id);

            if (!user) {
                errorResponse.sendError({
                    res,
                    message: 'User not found',
                    statusCode: 404
                });
                return;
            }

            // Remove password from response
            const userResponse = { ...user.toObject(), password: undefined };

            responseResult.sendResponse({
                res,
                data: userResponse,
                message: 'User deactivated successfully',
                statusCode: 200
            });

            Logging.info(`User deactivated in tenant ${req.tenant?.subdomain}: ${user.email}`);
        } catch (error) {
            errorResponse.sendError({
                res,
                message: (error as Error).message || 'Failed to deactivate user',
                statusCode: 500
            });
        }
    };

    /**
     * Search users
     */
    private searchUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            this.validateTenantContext(req);
            
            const { term } = req.params;

            if (!term || term.trim().length < 2) {
                errorResponse.sendError({
                    res,
                    message: 'Search term must be at least 2 characters long',
                    statusCode: 400
                });
                return;
            }

            const users = await this.userService.search(req.tenantConnection!, term);

            // Remove passwords from response
            const usersResponse = users.map(user => ({ ...user.toObject(), password: undefined }));

            responseResult.sendResponse({
                res,
                data: usersResponse,
                message: 'Users search completed',
                statusCode: 200
            });
        } catch (error) {
            errorResponse.sendError({
                res,
                message: (error as Error).message || 'Failed to search users',
                statusCode: 500
            });
        }
    };

    /**
     * Get user statistics (landlord or tenant)
     */
    private getUserStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            this.validateTenantContext(req);
            
            let activeUsersCount: number;

            if (req.isLandlord) {
                // For landlord, we could count all users or implement specific logic
                activeUsersCount = await this.userService.getActiveCount(req.tenantConnection!);
            } else {
                activeUsersCount = await this.userService.getActiveCount(req.tenantConnection!);
            }

            responseResult.sendResponse({
                res,
                data: {
                    activeUsers: activeUsersCount,
                    context: req.isLandlord ? 'landlord' : 'tenant',
                    tenant: req.tenant?.name || 'Main Database',
                    subdomain: req.subdomain || 'landlord'
                },
                message: 'User statistics retrieved successfully',
                statusCode: 200
            });
        } catch (error) {
            errorResponse.sendError({
                res,
                message: (error as Error).message || 'Failed to retrieve user statistics',
                statusCode: 500
            });
        }
    };
}

export default new UserController().router;
