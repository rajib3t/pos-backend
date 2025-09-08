import { Connection } from 'mongoose';
import { TenantUserRepository } from '../repositories/tenantUserRepository';
import { IUser } from '../models/user.model';
import Logging from '../libraries/logging.library';

export class TenantUserService {
    private userRepository: TenantUserRepository;
    private tenantId: string;

    constructor(tenantConnection: Connection, tenantId: string) {
        this.userRepository = new TenantUserRepository(tenantConnection);
        this.tenantId = tenantId;
        Logging.info(`TenantUserService initialized for tenant: ${tenantId}`);
    }

    /**
     * Create a new user in the tenant's database
     */
    async createUser(userData: Partial<IUser>): Promise<IUser> {
        try {
            // Validate required fields
            if (!userData.name || !userData.email || !userData.password) {
                throw new Error('Name, email, and password are required');
            }

            // Check if user already exists
            const existingUser = await this.userRepository.findByEmail(userData.email);
            if (existingUser) {
                throw new Error('User with this email already exists');
            }

            const user = await this.userRepository.create(userData);
            Logging.info(`User created in tenant ${this.tenantId}: ${user.email}`);
            return user;
        } catch (error) {
            Logging.error(`Failed to create user in tenant ${this.tenantId}: ${error}`);
            throw error;
        }
    }

    /**
     * Get user by ID
     */
    async getUserById(id: string): Promise<IUser | null> {
        try {
            return await this.userRepository.findById(id);
        } catch (error) {
            Logging.error(`Failed to get user by ID in tenant ${this.tenantId}: ${error}`);
            throw error;
        }
    }

    /**
     * Get user by email
     */
    async getUserByEmail(email: string): Promise<IUser | null> {
        try {
            return await this.userRepository.findByEmail(email);
        } catch (error) {
            Logging.error(`Failed to get user by email in tenant ${this.tenantId}: ${error}`);
            throw error;
        }
    }

    /**
     * Get all users with pagination
     */
    async getUsers(page: number = 1, limit: number = 10): Promise<{
        data: IUser[];
        total: number;
        page: number;
        totalPages: number;
    }> {
        try {
            return await this.userRepository.findWithPagination({}, page, limit);
        } catch (error) {
            Logging.error(`Failed to get users in tenant ${this.tenantId}: ${error}`);
            throw error;
        }
    }

    /**
     * Update user
     */
    async updateUser(id: string, userData: Partial<IUser>): Promise<IUser | null> {
        try {
            // If email is being updated, check for conflicts
            if (userData.email) {
                const existingUser = await this.userRepository.findByEmail(userData.email);
                if (existingUser && existingUser.id !== id) {
                    throw new Error('User with this email already exists');
                }
            }

            const user = await this.userRepository.update(id, userData);
            if (user) {
                Logging.info(`User updated in tenant ${this.tenantId}: ${user.email}`);
            }
            return user;
        } catch (error) {
            Logging.error(`Failed to update user in tenant ${this.tenantId}: ${error}`);
            throw error;
        }
    }

    /**
     * Delete user
     */
    async deleteUser(id: string): Promise<IUser | null> {
        try {
            const user = await this.userRepository.delete(id);
            if (user) {
                Logging.info(`User deleted in tenant ${this.tenantId}: ${user.email}`);
            }
            return user;
        } catch (error) {
            Logging.error(`Failed to delete user in tenant ${this.tenantId}: ${error}`);
            throw error;
        }
    }

    /**
     * Deactivate user
     */
    async deactivateUser(id: string): Promise<IUser | null> {
        try {
            const user = await this.userRepository.deactivateUser(id);
            if (user) {
                Logging.info(`User deactivated in tenant ${this.tenantId}: ${user.email}`);
            }
            return user;
        } catch (error) {
            Logging.error(`Failed to deactivate user in tenant ${this.tenantId}: ${error}`);
            throw error;
        }
    }

    /**
     * Search users
     */
    async searchUsers(searchTerm: string): Promise<IUser[]> {
        try {
            return await this.userRepository.searchUsers(searchTerm);
        } catch (error) {
            Logging.error(`Failed to search users in tenant ${this.tenantId}: ${error}`);
            throw error;
        }
    }

    /**
     * Get active users count
     */
    async getActiveUsersCount(): Promise<number> {
        try {
            return await this.userRepository.count({ isActive: true });
        } catch (error) {
            Logging.error(`Failed to get active users count in tenant ${this.tenantId}: ${error}`);
            throw error;
        }
    }
}
