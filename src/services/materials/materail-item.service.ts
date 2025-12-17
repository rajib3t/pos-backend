import { Connection } from "mongoose";
import MaterialItemRepository from "../../repositories/materials/material-item.repository";
import { IMaterialItem } from "../../models/materials/material-item.model";
import { PaginatedResult, PaginationOptions, QueryOptions } from '../../repositories/repository';
import Logging from "../../libraries/logging.library";
import { es } from "zod/locales";

class MaterialItemService {
    private static instance: MaterialItemService;
    private repository: MaterialItemRepository;
    private constructor() {
            this.repository = new MaterialItemRepository();
            
        }
    public static getInstance(): MaterialItemService {
        if (!MaterialItemService.instance) {
            MaterialItemService.instance = new MaterialItemService();
        }
        return MaterialItemService.instance;
    } 

    // Original methods (for backward compatibility with main database)
    public async create(userData: Partial<IMaterialItem>): Promise<IMaterialItem>;
    public async create(tenantConnection: Connection, userData: Partial<IMaterialItem>): Promise<IMaterialItem>;
    public async create(connectionOrData: Connection | Partial<IMaterialItem>, userData?: Partial<IMaterialItem>): Promise<IMaterialItem> {
        if (connectionOrData instanceof Connection) {
            // Using tenant connection
            const repositoryForTenant = new MaterialItemRepository(connectionOrData);
            return await repositoryForTenant.create(userData!);
        } else {
            // Using main database (backward compatibility)

            return await this.repository.create(connectionOrData);
        }
    }

    public async findById(id: string, options?: QueryOptions): Promise<IMaterialItem | null>;
    public async findById(connection: Connection, id: string, options?: QueryOptions): Promise<IMaterialItem | null>;
    public async findById(connectionOrId: string | Connection, idOrOptions?: string | QueryOptions, options?: QueryOptions): Promise<IMaterialItem | null> {
        if (connectionOrId instanceof Connection) {
            // Tenant-aware version
            try {
                const repositoryForTenant = new MaterialItemRepository(connectionOrId);
                return await repositoryForTenant.findById(idOrOptions as string, options);
            } catch (error) {
                
                throw error;
            }
        } else {
            // Original version
            return await this.repository.findById(connectionOrId, idOrOptions as QueryOptions | undefined);
        }
    }
    public async findByKey(condition: { [key: string]: any }, options?: QueryOptions): Promise<IMaterialItem | null>;
    public async findByKey(tenantConnection: Connection, condition: { [key: string]: any }, options?: QueryOptions): Promise<IMaterialItem | null>;
    public async findByKey(connectionOrCondition: Connection | { [key: string]: any }, condition?: { [key: string]: any }, options?: QueryOptions): Promise<IMaterialItem | null> {
        if (connectionOrCondition instanceof Connection) {
            // Tenant-aware version
            try {
                const repositoryForTenant = new MaterialItemRepository(connectionOrCondition);
                return await repositoryForTenant.findOne(condition!, options);
            } catch (error) {
                
                throw error;
            }
        } else {
            // Original version
            return await this.repository.findOne( connectionOrCondition!, options );
        }
    }

    public async findPaginated(options?: PaginationOptions<IMaterialItem>): Promise<PaginatedResult<IMaterialItem>>;
    public async findPaginated(tenantConnection: Connection, options?: PaginationOptions<IMaterialItem>): Promise<PaginatedResult<IMaterialItem>>;
    public async findPaginated(connectionOrOptions?: Connection | PaginationOptions<IMaterialItem>, options?: PaginationOptions<IMaterialItem>): Promise<PaginatedResult<IMaterialItem>> {
        if (connectionOrOptions instanceof Connection) {
            // Tenant-aware version
            try {
                const repositoryForTenant = new MaterialItemRepository(connectionOrOptions);
                return await repositoryForTenant.findPaginated(options);
            } catch (error) {
                
                throw error;
            }
        } else {
            // Original version
            return await this.repository.findPaginated(connectionOrOptions);
        }
    }   

    public async findMany(tenantConnection: Connection, condition: { [key: string]: any }, options?: QueryOptions): Promise<IMaterialItem[] | null>;
    public async findMany(condition: { [key: string]: any }, options?: QueryOptions): Promise<IMaterialItem[] | null>;
    public async findMany(connectionOrCondition: Connection | { [key: string]: any }, conditionOrOptions?: { [key: string]: any } | QueryOptions, options?: QueryOptions): Promise<IMaterialItem[] | null> {
        if (connectionOrCondition instanceof Connection) {
            // Using tenant connection
            const repositoryForTenant = new MaterialItemRepository(connectionOrCondition);
            return await repositoryForTenant.findMany(conditionOrOptions as { [key: string]: any }, options);
        } else {
            // Using main database (backward compatibility)
            return await this.repository.findMany(connectionOrCondition, conditionOrOptions as QueryOptions | undefined);
        }
    }

    public async findAllByKey(condition: { [key: string]: any }): Promise<IMaterialItem[] | null>;
    public async findAllByKey(tenantConnection: Connection, condition: { [key: string]: any }): Promise<IMaterialItem[] | null>;
    public async findAllByKey(connectionOrCondition: Connection | { [key: string]: any }, condition?: { [key: string]: any }): Promise<IMaterialItem[] | null> {
        if (connectionOrCondition instanceof Connection) {
            // Using tenant connection
            const repositoryForTenant = new MaterialItemRepository(connectionOrCondition);
            return await repositoryForTenant.findMany(condition!);
        } else {
            // Using main database (backward compatibility)
            return await this.repository.findMany(connectionOrCondition);
        }
    }


    public async update(id: string, data: Partial<IMaterialItem>): Promise<IMaterialItem | null>;
    public async update(tenantConnection: Connection, id: string, data: Partial<IMaterialItem>): Promise<IMaterialItem | null>;
    public async update(connectionOrId: Connection | string, idOrData: string | Partial<IMaterialItem>, data?: Partial<IMaterialItem>): Promise<IMaterialItem | null> {
        if (connectionOrId instanceof Connection) {
            // Using tenant connection
            const repositoryForTenant = new MaterialItemRepository(connectionOrId);
            return await repositoryForTenant.update(idOrData as string, data!);
        } else {
            // Using main database (backward compatibility)
            return await this.repository.update(connectionOrId, idOrData as Partial<IMaterialItem>);
        }
    }

    public async delete(id: string): Promise<IMaterialItem | null | { deletedCount?: number }>;
    public async delete(tenantConnection: Connection, id: string): Promise<IMaterialItem | null | { deletedCount?: number }>;
    public async delete(connectionOrId: Connection | string, id?: string): Promise<IMaterialItem | null | { deletedCount?: number }> {
        if (connectionOrId instanceof Connection) {
            // Using tenant connection
            const repositoryForTenant = new MaterialItemRepository(connectionOrId);
            return await repositoryForTenant.delete(id!);
        } else {
            // Using main database (backward compatibility)
            return await this.repository.delete(connectionOrId);
        }
    }

    

}


export default MaterialItemService;