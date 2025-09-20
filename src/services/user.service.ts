import { IProfileData, UserRepository } from '../repositories/user.repository';
import { IUser } from '../models/user.model';
import { NextFunction, Request, Response } from 'express';
import { IAddress } from '../models/address.model';
import  AddressRepository  from '../repositories/address.repository';
import { Connection } from 'mongoose';
import { TenantModelFactory } from '../utils/tenantModelFactory';
import Logging from '../libraries/logging.library';
import { PaginatedResult, PaginationOptions, QueryOptions } from '@/repositories/repository';
import database, { IDatabase } from "../database";
class UserService {
   
    private userRepository: UserRepository;
    private addressRepository: AddressRepository;
    private static instance: UserService;
    private database!: IDatabase;
    private constructor() {
        this.userRepository = new UserRepository();
        this.addressRepository = new AddressRepository();
        this.database = database;
    }
    
    public static getInstance(): UserService {
        if (!UserService.instance) {
            UserService.instance = new UserService();
        }
        return UserService.instance;
    }

    // Original methods (for backward compatibility with main database)
    public async create(userData: Partial<IUser>): Promise<IUser>;
    public async create(tenantConnection: Connection, userData: Partial<IUser>): Promise<IUser>;
    public async create(connectionOrData: Connection | Partial<IUser>, userData?: Partial<IUser>): Promise<IUser> {
        if (connectionOrData instanceof Connection) {
            // Tenant-aware version
            const connection = connectionOrData;
            const data = userData!;
            
            try {
                const tenantUserRepository = new UserRepository(connection);
                return await tenantUserRepository.create(data);
            } catch (error) {
                Logging.error(`Failed to create user: ${error}`);
                throw error;
            }
        } else {
            await this.database.connect();
            // Original version (main database) - for landlord requests
            return this.userRepository.create(connectionOrData);
        }
    }

    public async findByEmail(email: string): Promise<IUser | null>;
    public async findByEmail(tenantConnection: Connection, email: string): Promise<IUser | null>;
    public async findByEmail(connectionOrEmail: Connection | string, email?: string): Promise<IUser | null> {
        if (connectionOrEmail instanceof Connection) {
            // Tenant-aware version
            try {
                const tenantUserRepository = new UserRepository(connectionOrEmail);
                return await tenantUserRepository.findOne({ email: email! });
            } catch (error) {
                Logging.error(`Failed to find user by email: ${error}`);
                throw error;
            }
        } else {
            // Original version
            return this.userRepository.findByEmail(connectionOrEmail);
        }
    }

    public async findByMobile(mobile: string): Promise<IUser | null>;
    public async findByMobile(tenantConnection: Connection, mobile: string): Promise<IUser | null>;
    public async findByMobile(connectionOrMobile: Connection | string, mobile?: string): Promise<IUser | null> {
        if (connectionOrMobile instanceof Connection) {
            // Tenant-aware version
            try {
                const tenantUserRepository = new UserRepository(connectionOrMobile);
                return await tenantUserRepository.findOne({ mobile: mobile! });
            } catch (error) {
                Logging.error(`Failed to find user by mobile: ${error}`);
                throw error;
            }
        } else {
            // Original version
            return this.userRepository.findByMobile(connectionOrMobile);
        }
    }

               

   public async findById(id: string, options?: QueryOptions): Promise<IUser | null>;
public async findById(connection: Connection, id: string, options?: QueryOptions): Promise<IUser | null>;
public async findById(connectionOrId: string | Connection, idOrOptions?: string | QueryOptions, options?: QueryOptions): Promise<IUser | null> {
    if (connectionOrId instanceof Connection) {
        // Tenant-aware version
        try {
            const tenantUserRepository = new UserRepository(connectionOrId);
            return await tenantUserRepository.findById(idOrOptions as string, options);
        } catch (error) {
            Logging.error(`Failed to find user by ID: ${error}`);
            throw error;
        }
    } else {
        // Original version
        return this.userRepository.findById(connectionOrId, idOrOptions as QueryOptions | undefined);
    }
}

    

    public async update(id: string, userData: Partial<IUser>): Promise<IUser | null>;
    public async update(tenantConnection: Connection, id: string, userData: Partial<IUser>): Promise<IUser | null>;
    public async update(connectionOrId: Connection | string, idOrData: string | Partial<IUser>, userData?: Partial<IUser>): Promise<IUser | null> {
        if (connectionOrId instanceof Connection) {
            // Tenant-aware version
            try {
                 const tenantUserRepository = new UserRepository(connectionOrId);
                return await tenantUserRepository.update(idOrData as string, userData!);
               
            } catch (error) {
                Logging.error(`Failed to update user: ${error}`);
                throw error;
            }
        } else {
            // Original version
            return this.userRepository.update(connectionOrId, idOrData as Partial<IUser>);
        }
    }

    public async delete(id: string): Promise<IUser | null>;
    public async delete(tenantConnection: Connection, id: string): Promise<IUser | null>;
    public async delete(connectionOrId: Connection | string, id?: string): Promise<IUser | null> {
        if (connectionOrId instanceof Connection) {
            // Tenant-aware version
            try {
                const UserModel = TenantModelFactory.getUserModel(connectionOrId);
                const user = await UserModel.findByIdAndDelete(id!);
                if (user) {
                    Logging.info(`User deleted: ${user.email}`);
                }
                return user;
            } catch (error) {
                Logging.error(`Failed to delete user: ${error}`);
                throw error;
            }
        } else {
            // Original version
            const result = await this.userRepository.delete(connectionOrId);
            return result as IUser | null;
        }
    }

    // New tenant-aware methods
    public async findAll(
        tenantConnection: Connection,
        page: number = 1,
        limit: number = 10,
        filter: any = {}
    ): Promise<{ data: IUser[]; total: number; page: number; totalPages: number }> {
        try {
            const UserModel = TenantModelFactory.getUserModel(tenantConnection);
            const skip = (page - 1) * limit;

            const [data, total] = await Promise.all([
                UserModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
                UserModel.countDocuments(filter)
            ]);

            const totalPages = Math.ceil(total / limit);
            return { data, total, page, totalPages };
        } catch (error) {
            Logging.error(`Failed to find users: ${error}`);
            throw error;
        }
    }

    /**
     * Landlord-aware findAll method
     * Uses main database for landlord requests, tenant database for tenant requests
     */
    public async findAllLandlordAware(
        connection: Connection,
        isLandlord: boolean = false,
        page: number = 1,
        limit: number = 10,
        filter: any = {}
    ): Promise<{ data: IUser[]; total: number; page: number; totalPages: number }> {
        if (isLandlord) {
            // Use original repository for main database
            try {
                const skip = (page - 1) * limit;
                // Using TenantModelFactory to get the appropriate User model for this tenant
                const UserModel = TenantModelFactory.getUserModel(connection);
                
                const [data, total] = await Promise.all([
                    UserModel.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
                    UserModel.countDocuments(filter)
                ]);

                const totalPages = Math.ceil(total / limit);
                return { data, total, page, totalPages };
            } catch (error) {
                Logging.error(`Failed to find landlord users: ${error}`);
                throw error;
            }
        } else {
            return this.findAll(connection, page, limit, filter);
        }
    }

    public async deactivate(tenantConnection: Connection, id: string): Promise<IUser | null> {
        try {
            const UserModel = TenantModelFactory.getUserModel(tenantConnection);
            const user = await UserModel.findByIdAndUpdate(id, { isActive: false }, { new: true });
            if (user) {
                Logging.info(`User deactivated: ${user.email}`);
            }
            return user;
        } catch (error) {
            Logging.error(`Failed to deactivate user: ${error}`);
            throw error;
        }
    }

    public async search(tenantConnection: Connection, searchTerm: string): Promise<IUser[]> {
        try {
            const UserModel = TenantModelFactory.getUserModel(tenantConnection);
            const regex = new RegExp(searchTerm, 'i');
            
            return await UserModel.find({
                $or: [
                    { name: { $regex: regex } },
                    { email: { $regex: regex } }
                ]
            });
        } catch (error) {
            Logging.error(`Failed to search users: ${error}`);
            throw error;
        }
    }

    public async getActiveCount(tenantConnection: Connection): Promise<number> {
        try {
            const UserModel = TenantModelFactory.getUserModel(tenantConnection);
            return await UserModel.countDocuments({ isActive: true });
        } catch (error) {
            Logging.error(`Failed to get active users count: ${error}`);
            throw error;
        }
    }

    // Original methods continue to work with main database
    public async addOrUpdateAddress(user: IUser, addressData: Partial<IAddress>): Promise<IAddress | null> {
        const existingAddress = await this.addressRepository.findByUserId(user._id as string);
        if (existingAddress) {
            return this.addressRepository.update(existingAddress._id as string, addressData);
        }
        return this.addressRepository.create( addressData);
    }
    public async getUserProfile(userId: string): Promise<IProfileData | null>;
    public async getUserProfile(tenantConnection: Connection, id: string): Promise<IProfileData | null>;
    public async getUserProfile(connectionOrId: Connection | string, id?: string): Promise<IProfileData | null> {
        if (connectionOrId instanceof Connection) {
            // Tenant-aware version - create local repository instance to avoid modifying class property
            try {
                const tenantUserRepository = new UserRepository(connectionOrId);
                const user = await tenantUserRepository.findById(id!);
                
                if (!user) {
                    return null;
                }

                // Get address using tenant-specific Address model
                const AddressModel = TenantModelFactory.getAddressModel(connectionOrId);
                const address = await AddressModel.findOne({ userId: id! }).lean().exec();

                return {
                    ...user,
                    // address: address ? {
                    //     street: address.street,
                    //     city: address.city,
                    //     state: address.state,
                    //     zip: address.zip
                    // } : undefined
                } as IProfileData;
            } catch (error) {
                Logging.error(`Failed to get user profile: ${error}`);
                throw error;
            }
        } else {
            // Original version - uses main database with address population
            const user = await this.userRepository.getUserProfileWithAddress(connectionOrId);
            return user;
        }
    }


    public async  getUsersWithPagination(options?: PaginationOptions<IUser>) :Promise<PaginatedResult<IUser> | null>;
    public async  getUsersWithPagination(tenantConnection?: Connection, options?: PaginationOptions<IUser>) :Promise<PaginatedResult<IUser> | null>;
    public async  getUsersWithPagination(connectionOrOptions?: Connection | PaginationOptions<IUser>, optionsArg?: PaginationOptions<IUser>) :Promise<PaginatedResult<IUser> | null> {
        if (connectionOrOptions instanceof Connection) {
            // Using tenant connection - create local repository instance to avoid modifying class property
            const tenantUserRepository = new UserRepository(connectionOrOptions);
            return tenantUserRepository.findPaginated(optionsArg || {});
        } else {
            // Using main database (backward compatibility)
            Logging.info(`Using main database for getUsersWithPagination`);
            return this.userRepository.findPaginated(connectionOrOptions)
        }

    }
}

export default UserService;