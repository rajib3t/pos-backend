import { Connection } from "mongoose";
import StoreRepository from "../../repositories/store/store.repository";
import { IStore } from "../../models/store/store.model";
import { PaginatedResult, PaginationOptions, QueryOptions } from '../../repositories/repository';
import Logging from "../../libraries/logging.library";

class StoreService {
    private static instance: StoreService;
    private repository: StoreRepository;
    
    private constructor() {
        this.repository = new StoreRepository();
    }

    public static getInstance(): StoreService {
        if (!StoreService.instance) {
            StoreService.instance = new StoreService();
        }
        return StoreService.instance;
    }

    // Create a new store
    public async create(storeData: Partial<IStore>): Promise<IStore>;
    public async create(tenantConnection: Connection, storeData: Partial<IStore>): Promise<IStore>;
    public async create(connectionOrData: Connection | Partial<IStore>, storeData?: Partial<IStore>): Promise<IStore> {
        if (connectionOrData instanceof Connection) {
            // Using tenant connection
            const repositoryForTenant = new StoreRepository(connectionOrData);
            return await repositoryForTenant.create(storeData!);
        } else {
            // Using main database (backward compatibility)
            return await this.repository.create(connectionOrData);
        }
    }

    public async findAllByKey(condition: { [key: string]: any }): Promise<IStore[] | null>;
    public async findAllByKey(tenantConnection: Connection, condition: { [key: string]: any }): Promise<IStore[] | null>;
    public async findAllByKey(connectionOrCondition: Connection | { [key: string]: any }, condition?: { [key: string]: any }): Promise<IStore[] | null> {
        if (connectionOrCondition instanceof Connection) {
            // Using tenant connection
            const repositoryForTenant = new StoreRepository(connectionOrCondition);
            return await repositoryForTenant.findMany(condition!);
        } else {
            // Using main database (backward compatibility)
            return await this.repository.findMany(connectionOrCondition);
        }
    }

    // Find store by ID
    public async findById(id: string, options?: QueryOptions): Promise<IStore | null>;
    public async findById(connection: Connection, id: string, options?: QueryOptions): Promise<IStore | null>;
    public async findById(connectionOrId: string | Connection, idOrOptions?: string | QueryOptions, options?: QueryOptions): Promise<IStore | null> {
        if (connectionOrId instanceof Connection) {
            // Tenant-aware version
            try {
                const repositoryForTenant = new StoreRepository(connectionOrId);
                return await repositoryForTenant.findById(idOrOptions as string, options);
            } catch (error) {
                Logging.error(`Error finding store by ID: ${error}`);
                throw error;
            }
        } else {
            // Original version
            return await this.repository.findById(connectionOrId, idOrOptions as QueryOptions | undefined);
        }
    }

    // Update a store
    public async update(id: string, storeData: Partial<IStore>): Promise<IStore | null>;
    public async update(tenantConnection: Connection, id: string, storeData: Partial<IStore>): Promise<IStore | null>;
    public async update(connectionOrId: Connection | string, idOrData: string | Partial<IStore>, storeData?: Partial<IStore>): Promise<IStore | null> {
        if (connectionOrId instanceof Connection) {
            // Tenant-aware version
            try {
                const repositoryForTenant = new StoreRepository(connectionOrId);
                return await repositoryForTenant.update(idOrData as string, storeData!);
            } catch (error) {
                Logging.error(`Failed to update store: ${error}`);
                throw error;
            }
        } else {
            // Original version
            return await this.repository.update(connectionOrId, idOrData as Partial<IStore>);
        }
    }

    // Delete a store
    public async delete(id: string): Promise<IStore | null>;
    public async delete(tenantConnection: Connection, id: string): Promise<IStore | null>;
    public async delete(connectionOrId: Connection | string, id?: string): Promise<IStore | null> {
        if (connectionOrId instanceof Connection) {
            // Tenant-aware version
            try {
                const repositoryForTenant = new StoreRepository(connectionOrId);
                const result = await repositoryForTenant.delete(id!);
                return result as IStore | null;
            } catch (error) {
                Logging.error(`Failed to delete store: ${error}`);
                throw error;
            }
        } else {
            // Original version
            return await this.repository.delete(connectionOrId) as IStore | null;
        }
    }

    // Get stores with pagination
    public async getDataWithPagination(options?: PaginationOptions<IStore>): Promise<PaginatedResult<IStore> | null>;
    public async getDataWithPagination(tenantConnection?: Connection, options?: PaginationOptions<IStore>): Promise<PaginatedResult<IStore> | null>;
    public async getDataWithPagination(connectionOrOptions?: Connection | PaginationOptions<IStore>, optionsArg?: PaginationOptions<IStore>): Promise<PaginatedResult<IStore> | null> {
        if (connectionOrOptions instanceof Connection) {
            // Using tenant connection
            Logging.info(`Using tenant database for getDataWithPagination`);
            const tenantStoreRepository = new StoreRepository(connectionOrOptions);
            return tenantStoreRepository.findPaginated(optionsArg || {});
        } else {
            // Using main database (backward compatibility)
            Logging.info(`Using main database for getDataWithPagination`);
            return this.repository.findPaginated(connectionOrOptions || {});
        }
    }

    // Find all stores
    public async findAll(options?: QueryOptions): Promise<IStore[] | null>;
    public async findAll(tenantConnection: Connection): Promise<IStore[] | null>;
    public async findAll(connectionOrOptions?: Connection | QueryOptions): Promise<IStore[] | null> {
        if (connectionOrOptions instanceof Connection) {
            const repositoryForTenant = new StoreRepository(connectionOrOptions);
            return await repositoryForTenant.findAll();
        } else {
            return await this.repository.findAll(connectionOrOptions);
        }
    }

  

    public async findByCode(code: string, connection?: Connection): Promise<IStore | null> {
        try {
            if (connection) {
                const repositoryForTenant = new StoreRepository(connection);
                return await repositoryForTenant.findOne({ code });
            }
            return await this.repository.findOne({ code });
        } catch (error) {
            Logging.error(`Error finding store by code: ${error}`);
            throw error;
        }
    }
}

export default StoreService;
