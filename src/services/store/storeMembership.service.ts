import { Connection } from "mongoose";
import StoreMembershipRepository from "../../repositories/store/storeMembership.repository";
import { IStoreMembership } from "../../models/store/storeMembership.model";
import { PaginatedResult, PaginationOptions, QueryOptions } from '../../repositories/repository';
import Logging from "../../libraries/logging.library";

class StoreMembershipService {
    private static instance: StoreMembershipService;
    private repository: StoreMembershipRepository;
    
    private constructor() {
        this.repository = new StoreMembershipRepository();
    }

    public static getInstance(): StoreMembershipService {
        if (!StoreMembershipService.instance) {
            StoreMembershipService.instance = new StoreMembershipService();
        }
        return StoreMembershipService.instance;
    }

    // Create a new store membership
    public async create(membershipData: Partial<IStoreMembership>): Promise<IStoreMembership>;
    public async create(tenantConnection: Connection, membershipData: Partial<IStoreMembership>): Promise<IStoreMembership>;
    public async create(connectionOrData: Connection | Partial<IStoreMembership>, membershipData?: Partial<IStoreMembership>): Promise<IStoreMembership> {
        if (connectionOrData instanceof Connection) {
            // Using tenant connection
            const repositoryForTenant = new StoreMembershipRepository(connectionOrData);
            return await repositoryForTenant.create(membershipData!);
        } else {
            // Using main database (backward compatibility)
            return await this.repository.create(connectionOrData);
        }
    }

    // Find store membership by ID
    public async findById(id: string, options?: QueryOptions): Promise<IStoreMembership | null>;
    public async findById(connection: Connection, id: string, options?: QueryOptions): Promise<IStoreMembership | null>;
    public async findById(connectionOrId: string | Connection, idOrOptions?: string | QueryOptions, options?: QueryOptions): Promise<IStoreMembership | null> {
        if (connectionOrId instanceof Connection) {
            // Tenant-aware version
            try {
                const repositoryForTenant = new StoreMembershipRepository(connectionOrId);
                return await repositoryForTenant.findById(idOrOptions as string, options);
            } catch (error) {
                Logging.error(`Error finding store membership by ID: ${error}`);
                throw error;
            }
        } else {
            // Original version
            return await this.repository.findById(connectionOrId, idOrOptions as QueryOptions | undefined);
        }
    }

    // Update a store membership
    public async update(id: string, membershipData: Partial<IStoreMembership>): Promise<IStoreMembership | null>;
    public async update(tenantConnection: Connection, id: string, membershipData: Partial<IStoreMembership>): Promise<IStoreMembership | null>;
    public async update(connectionOrId: Connection | string, idOrData: string | Partial<IStoreMembership>, membershipData?: Partial<IStoreMembership>): Promise<IStoreMembership | null> {
        if (connectionOrId instanceof Connection) {
            // Tenant-aware version
            try {
                const repositoryForTenant = new StoreMembershipRepository(connectionOrId);
                return await repositoryForTenant.update(idOrData as string, membershipData!);
            } catch (error) {
                Logging.error(`Failed to update store membership: ${error}`);
                throw error;
            }
        } else {
            // Original version
            return await this.repository.update(connectionOrId, idOrData as Partial<IStoreMembership>);
        }
    }

    // Delete a store membership
    public async delete(id: string): Promise<IStoreMembership | null>;
    public async delete(tenantConnection: Connection, id: string): Promise<IStoreMembership | null>;
    public async delete(connectionOrId: Connection | string, id?: string): Promise<IStoreMembership | null> {
        if (connectionOrId instanceof Connection) {
            // Tenant-aware version
            try {
                const repositoryForTenant = new StoreMembershipRepository(connectionOrId);
                const result = await repositoryForTenant.delete(id!);
                return result as IStoreMembership | null;
            } catch (error) {
                Logging.error(`Failed to delete store membership: ${error}`);
                throw error;
            }
        } else {
            // Original version
            return await this.repository.delete(connectionOrId) as IStoreMembership | null;
        }
    }

    // Get store memberships with pagination
    public async getDataWithPagination(options?: PaginationOptions<IStoreMembership>): Promise<PaginatedResult<IStoreMembership> | null>;
    public async getDataWithPagination(tenantConnection?: Connection, options?: PaginationOptions<IStoreMembership>): Promise<PaginatedResult<IStoreMembership> | null>;
    public async getDataWithPagination(connectionOrOptions?: Connection | PaginationOptions<IStoreMembership>, optionsArg?: PaginationOptions<IStoreMembership>): Promise<PaginatedResult<IStoreMembership> | null> {
        if (connectionOrOptions instanceof Connection) {
            // Using tenant connection
            const tenantMembershipRepository = new StoreMembershipRepository(connectionOrOptions);
            return tenantMembershipRepository.findPaginated(optionsArg || {});
        } else {
            // Using main database (backward compatibility)
            Logging.info(`Using main database for getDataWithPagination`);
            return this.repository.findPaginated(connectionOrOptions || {});
        }
    }

    // Find all store memberships
    public async findAll(options?: QueryOptions): Promise<IStoreMembership[] | null>;
    public async findAll(tenantConnection: Connection): Promise<IStoreMembership[] | null>;
    public async findAll(connectionOrOptions?: Connection | QueryOptions): Promise<IStoreMembership[] | null> {
        if (connectionOrOptions instanceof Connection) {
            const repositoryForTenant = new StoreMembershipRepository(connectionOrOptions);
            return await repositoryForTenant.findAll();
        } else {
            return await this.repository.findAll(connectionOrOptions);
        }
    }

    


   


    public async addPermission(membershipId: string, permission: string, connection?: Connection): Promise<IStoreMembership | null> {
        try {
            const update = { 
                $addToSet: { permissions: permission }
            };
            
            if (connection) {
                const repositoryForTenant = new StoreMembershipRepository(connection);
                return await repositoryForTenant.update(membershipId, update);
            }
            return await this.repository.update(membershipId, update);
        } catch (error) {
            Logging.error(`Error adding permission: ${error}`);
            throw error;
        }
    }

    public async removePermission(membershipId: string, permission: string, connection?: Connection): Promise<IStoreMembership | null> {
        try {
            const update = { 
                $pull: { permissions: permission }
            };
            
            if (connection) {
                const repositoryForTenant = new StoreMembershipRepository(connection);
                return await repositoryForTenant.update(membershipId, update);
            }
            return await this.repository.update(membershipId, update);
        } catch (error) {
            Logging.error(`Error removing permission: ${error}`);
            throw error;
        }
    }
}

export default StoreMembershipService;
