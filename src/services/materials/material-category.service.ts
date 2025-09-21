import { Connection } from "mongoose";
import MaterialCategoryRepository from "../../repositories/materials/material-category.repository";
import { IMaterialCategory } from "../../models/materials/material-category.model";
import { PaginatedResult, PaginationOptions, QueryOptions } from '@/repositories/repository';
import Logging from "@/libraries/logging.library";
import { options } from "joi";

class MaterialCategoryService {
    private static instance: MaterialCategoryService;
    private repository: MaterialCategoryRepository;
    private constructor() {
            this.repository = new MaterialCategoryRepository();
            
        }
    public static getInstance(): MaterialCategoryService {
        if (!MaterialCategoryService.instance) {
            MaterialCategoryService.instance = new MaterialCategoryService();
        }
        return MaterialCategoryService.instance;
    }

     


     // Original methods (for backward compatibility with main database)
        public async create(userData: Partial<IMaterialCategory>): Promise<IMaterialCategory>;
        public async create(tenantConnection: Connection, userData: Partial<IMaterialCategory>): Promise<IMaterialCategory>;
        public async create(connectionOrData: Connection | Partial<IMaterialCategory>, userData?: Partial<IMaterialCategory>): Promise<IMaterialCategory> {
            if (connectionOrData instanceof Connection) {
                // Using tenant connection
                const repositoryForTenant = new MaterialCategoryRepository(connectionOrData);
                return await repositoryForTenant.create(userData!);
            } else {
                // Using main database (backward compatibility)

                return await this.repository.create(connectionOrData);
            }
        }


        public async findById(id: string, options?: QueryOptions): Promise<IMaterialCategory | null>;
        public async findById(connection: Connection, id: string, options?: QueryOptions): Promise<IMaterialCategory | null>;
        public async findById(connectionOrId: string | Connection, idOrOptions?: string | QueryOptions, options?: QueryOptions): Promise<IMaterialCategory | null> {
            if (connectionOrId instanceof Connection) {
                // Tenant-aware version
                try {
                    const repositoryForTenant = new MaterialCategoryRepository(connectionOrId);
                    return await repositoryForTenant.findById(idOrOptions as string, options);
                } catch (error) {
                    
                    throw error;
                }
            } else {
                // Original version
                return await this.repository.findById(connectionOrId, idOrOptions as QueryOptions | undefined);
            }
        }

        public async update(id: string, userData: Partial<IMaterialCategory>): Promise<IMaterialCategory | null>;
        public async update(tenantConnection: Connection, id: string, userData: Partial<IMaterialCategory>): Promise<IMaterialCategory | null>;
        public async update(connectionOrId: Connection | string, idOrData: string | Partial<IMaterialCategory>, userData?: Partial<IMaterialCategory>): Promise<IMaterialCategory | null> {
            if (connectionOrId instanceof Connection) {
                // Tenant-aware version
                try {
                    const repositoryForTenant = new MaterialCategoryRepository(connectionOrId);
                    return await repositoryForTenant.update(idOrData as string, userData!);

                } catch (error) {
                    Logging.error(`Failed to update material category: ${error}`);
                    throw error;
                }
            } else {
                // Original version
                return  await this.repository.update(connectionOrId, idOrData as Partial<IMaterialCategory>);
            }
        }


        public async delete(id: string): Promise<IMaterialCategory | null>;
        public async delete(tenantConnection: Connection, id: string): Promise<IMaterialCategory | null>;
        public async delete(connectionOrId: Connection | string, id?: string): Promise<IMaterialCategory | null> {
            if (connectionOrId instanceof Connection) {
                // Tenant-aware version
                try {
                    const repositoryForTenant = new MaterialCategoryRepository(connectionOrId);
                    const result = await repositoryForTenant.delete(id!);
                    return result as IMaterialCategory | null;
                } catch (error) {
                    Logging.error(`Failed to delete material category: ${error}`);
                        throw error;
                    }
                } else {
                    // Original version
                    return await this.repository.delete(connectionOrId) as IMaterialCategory | null;
                }
        }
        public async  getDataWithPagination(options?: PaginationOptions<IMaterialCategory>) :Promise<PaginatedResult<IMaterialCategory> | null>;
        public async  getDataWithPagination(tenantConnection?: Connection, options?: PaginationOptions<IMaterialCategory>) :Promise<PaginatedResult<IMaterialCategory> | null>;
        public async  getDataWithPagination(connectionOrOptions?: Connection | PaginationOptions<IMaterialCategory>, optionsArg?: PaginationOptions<IMaterialCategory>) :Promise<PaginatedResult<IMaterialCategory> | null> {
            if (connectionOrOptions instanceof Connection) {
                // Using tenant connection - create local repository instance to avoid modifying class property
                const tenantMaterialCategoryRepository = new MaterialCategoryRepository(connectionOrOptions);
                return tenantMaterialCategoryRepository.findPaginated(optionsArg || {});
            } else {
                // Using main database (backward compatibility)
                Logging.info(`Using main database for getDataWithPagination`);
                return this.repository.findPaginated(connectionOrOptions)
            }
    
        }


        

        public async findAll(options?: QueryOptions): Promise<IMaterialCategory[] | null>;
        public async findAll(tenantConnection: Connection): Promise<IMaterialCategory[] | null>;
        public async findAll(connectionOrOptions?: Connection | QueryOptions): Promise<IMaterialCategory[] | null> {
            if (connectionOrOptions instanceof Connection) {
            const repositoryForTenant = new MaterialCategoryRepository(connectionOrOptions);
            return await repositoryForTenant.findAll();
            } else {
            return await this.repository.findAll(connectionOrOptions);
            }
        }


}


export default MaterialCategoryService;