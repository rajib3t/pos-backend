import { Request, Response, NextFunction } from 'express';
import { Controller } from './controller';
import { responseResult } from '../utils/response';
import { errorResponse } from '../utils/errorResponse';
import { TenantUserService } from '../services/tenantUserService';
import { IUser } from '../models/user.model';
import Logging from '../libraries/logging.library';

class TenantUserController extends Controller {
    constructor() {
        super();
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
     * Get tenant user service from request context
     */
    private getTenantUserService(req: Request): TenantUserService {
        if (!req.tenant || !req.tenantConnection) {
            throw new Error('Tenant context is required');
        }
        return new TenantUserService(req.tenantConnection, req.tenant.subdomain);
    }

    /**
     * Create a new user in tenant's database
     */
    private createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { name, email, mobile, password } = req.body;

            if (!name || !email || !password) {
                errorResponse.sendError({
                    res,
                    message: 'Name, email, and password are required',
                    statusCode: 400
                });
                return;
            }

            const userService = this.getTenantUserService(req);
            const userData: Partial<IUser> = { name, email, mobile, password };
            const user = await userService.createUser(userData);

            // Remove password from response
            const userResponse = { ...user.toObject(), password: undefined };

            responseResult.sendResponse({
                res,
                data: userResponse,
                message: 'User created successfully',
                statusCode: 201
            });

            Logging.info(`User created in tenant ${req.tenant?.subdomain}: ${email}`);
        } catch (error) {
            errorResponse.sendError({
                res,
                message: (error as Error).message || 'Failed to create user',
                statusCode: 500
            });
        }
    };

    /**
     * Get users with pagination
     */
    private getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;

            const userService = this.getTenantUserService(req);
            const result = await userService.getUsers(page, limit);

            // Remove passwords from response
            const usersResponse = {
                ...result,
                data: result.data.map(user => ({ ...user.toObject(), password: undefined }))
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
     * Get user by ID
     */
    private getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;

            const userService = this.getTenantUserService(req);
            const user = await userService.getUserById(id);

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
     * Update user
     */
    private updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;
            const updateData = req.body;

            // Remove password from update data (should be handled separately)
            delete updateData.password;

            const userService = this.getTenantUserService(req);
            const user = await userService.updateUser(id, updateData);

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

            Logging.info(`User updated in tenant ${req.tenant?.subdomain}: ${user.email}`);
        } catch (error) {
            errorResponse.sendError({
                res,
                message: (error as Error).message || 'Failed to update user',
                statusCode: 500
            });
        }
    };

    /**
     * Delete user
     */
    private deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const { id } = req.params;

            const userService = this.getTenantUserService(req);
            const user = await userService.deleteUser(id);

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

            Logging.info(`User deleted in tenant ${req.tenant?.subdomain}: ${user.email}`);
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
            const { id } = req.params;

            const userService = this.getTenantUserService(req);
            const user = await userService.deactivateUser(id);

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
            const { term } = req.params;

            if (!term || term.trim().length < 2) {
                errorResponse.sendError({
                    res,
                    message: 'Search term must be at least 2 characters long',
                    statusCode: 400
                });
                return;
            }

            const userService = this.getTenantUserService(req);
            const users = await userService.searchUsers(term);

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
     * Get user statistics
     */
    private getUserStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userService = this.getTenantUserService(req);
            const activeUsersCount = await userService.getActiveUsersCount();

            responseResult.sendResponse({
                res,
                data: {
                    activeUsers: activeUsersCount,
                    tenant: req.tenant?.name,
                    subdomain: req.tenant?.subdomain
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

export default new TenantUserController().router;
