import { ITenant } from '../models/tenant.model';
import { TenantRepository } from '../repositories/tenant.repository';
import CreateDatabase from '../database/create';
import { TenantConnectionManager } from '../database/tenantConnection';
import Logging from '../libraries/logging.library';
import { PaginatedResult, PaginationOptions, QueryOptions } from '@/repositories/repository';
export default class TenantService {
    private static instance: TenantService;
    private tenantRepository: TenantRepository;
    private connectionManager: TenantConnectionManager;

    private constructor() {
        this.tenantRepository = new TenantRepository();
        this.connectionManager = TenantConnectionManager.getInstance();
    }

    public static getInstance(): TenantService {
        if (!TenantService.instance) {
            TenantService.instance = new TenantService();
        }
        return TenantService.instance;
    }

    public async create(tenantData: Partial<ITenant>): Promise<ITenant> {
        return this.tenantRepository.create(tenantData);
    }

    public async findById(id: string, options?: QueryOptions): Promise<ITenant | null> {
        return this.tenantRepository.findById(id, options);
    }

    public async findByIdWithRelations(id: string): Promise<ITenant | null> {
        const options: QueryOptions = {
            populate: [
                { path: 'createdBy', select: 'name email' },
                { path: 'updatedBy', select: 'name email' },
                { path: 'settings' }
            ]
        };
        return this.tenantRepository.findById(id, options);
    }

    public async findAll(options?: QueryOptions): Promise<ITenant[]> {
        return this.tenantRepository.findAll(options);
    }

    public async findAllWithRelations(): Promise<ITenant[]> {
        const options: QueryOptions = {
            populate: [
                { path: 'createdBy', select: 'name email' },
                { path: 'updatedBy', select: 'name email' },
                { path: 'settings' }
            ]
        };
        return this.tenantRepository.findAll(options);
    }

    public async update(id: string, tenantData: Partial<ITenant>): Promise<ITenant> {
        const updatedTenant = await this.tenantRepository.update(id, tenantData);
        if (!updatedTenant) {
            throw new Error(`Tenant with id ${id} not found`);
        }
        return updatedTenant;
    }

    public async delete(id: string): Promise<number | null> {
        const result = await this.tenantRepository.delete(id);
        if (typeof result === 'object' && result !== null && 'deletedCount' in result) {
            return result.deletedCount || 0;
        }
        return typeof result === 'number' ? result : null;
    }

   

    private generateDatabaseName(slug: string): string {
        return `db_${slug.toLowerCase().replace(/\s+/g, '_')}`;
    }

    private generateDatabaseUser(slug: string): string {
        return `user_${slug.toLowerCase().replace(/\s+/g, '_')}`;
    }

    private generateDatabasePassword(): string {
        return Math.random().toString(36).slice(-8);
    }

    public async registerTenant(tenantData: Partial<ITenant>): Promise<ITenant> {
        if (!tenantData.name || !tenantData.subdomain) {
            throw new Error("Tenant name and subdomain are required");
        }

        const databaseName = this.generateDatabaseName(tenantData.name);
        const databaseUser = this.generateDatabaseUser(tenantData.name);
        const databasePassword = this.generateDatabasePassword();

        const newTenantData: Partial<ITenant> = {
            ...tenantData,
            databaseName,
            databaseUser,
            databasePassword
        };

        try {
            // Create the tenant database and user
            await this.createTenantDatabase(newTenantData as ITenant);
            
            // Save tenant info to main database
            const tenant = await this.tenantRepository.create(newTenantData);
            
            Logging.info(`Tenant registered successfully: ${tenant.name} (${tenant.subdomain})`);
            return tenant;
        } catch (error) {
            Logging.error(`Failed to register tenant: ${error}`);
            throw new Error(`Tenant registration failed: ${(error as Error).message}`);
        }
    }

    public async checkSubdomainAvailability(subdomain: string): Promise<boolean> {
        try {
            const existingTenant = await this.tenantRepository.findBySubdomain(subdomain);
            return !existingTenant;
        } catch (error) {
            Logging.error(`Error checking subdomain availability: ${error}`);
            throw error;
        }
    }

    public async checkTenantExists(name: string): Promise<boolean> {
        try {
            const existingTenant = await this.tenantRepository.findOne({ 
                name: { $regex: new RegExp(`^${name}$`, 'i') } 
            });
            return !!existingTenant;
        } catch (error) {
            Logging.error(`Error checking tenant existence: ${error}`);
            throw error;
        }
    }

    public async createTenantDatabase(tenant: ITenant): Promise<void> {
        try {
            const createDb = CreateDatabase;
            await createDb.createDatabase(tenant.databaseName, tenant.databaseUser, tenant.databasePassword);
            Logging.info(`Database created for tenant: ${tenant.name}`);
        } catch (error) {
            Logging.error(`Failed to create database for tenant ${tenant.name}: ${error}`);
            throw error;
        }
    }

    /**
     * Test tenant database connection
     */
    public async testTenantConnection(tenant: ITenant): Promise<boolean> {
        try {
            const connection = await this.connectionManager.getTenantConnection(tenant);
            const isConnected = connection.readyState === 1;
            
            if (isConnected) {
                Logging.info(`Connection test successful for tenant: ${tenant.subdomain}`);
            } else {
                Logging.warning(`Connection test failed for tenant: ${tenant.subdomain}`);
            }
            
            return isConnected;
        } catch (error) {
            Logging.error(`Connection test error for tenant ${tenant.subdomain}: ${error}`);
            return false;
        }
    }

    /**
     * Get tenant by subdomain
     */
    public async getTenantBySubdomain(subdomain: string, withRelations: boolean = true): Promise<ITenant | null> {
        try {
            const options: QueryOptions | undefined = withRelations ? {
                populate: [
                    { path: 'createdBy', select: 'name email' },
                    { path: 'updatedBy', select: 'name email' },
                    { path: 'settings' }
                ]
            } : undefined;

            return await this.tenantRepository.findBySubdomain(subdomain.toLowerCase(), options);
        } catch (error) {
            Logging.error(`Error getting tenant by subdomain: ${error}`);
            throw error;
        }
    }

    /**
     * Delete tenant and cleanup resources
     */
    public async deleteTenant(id: string): Promise<void> {
        try {
            const tenant = await this.tenantRepository.findById(id);
            if (!tenant) {
                throw new Error('Tenant not found');
            }

            // Close tenant connection if exists
            await this.connectionManager.closeTenantConnection(tenant.subdomain);
            
            // Delete the tenant database and user
            try {
                await this.deleteTenantDatabase(tenant);
                Logging.info(`Database deleted for tenant: ${tenant.name}`);
            } catch (dbError) {
                Logging.warning(`Failed to delete database for tenant ${tenant.name}: ${dbError}`);
                // Continue with tenant record deletion even if database deletion fails
            }
            
            // Delete tenant record
            await this.tenantRepository.delete(id);
            
            Logging.info(`Tenant deleted: ${tenant.name} (${tenant.subdomain})`);
        } catch (error) {
            Logging.error(`Failed to delete tenant: ${error}`);
            throw error;
        }
    }

    public async deleteTenantDatabase(tenant: ITenant): Promise<void> {
        try {
            const createDb = CreateDatabase;
            await createDb.deleteDatabase(tenant.databaseName, tenant.databaseUser);
            Logging.info(`Database deleted for tenant: ${tenant.name}`);
        } catch (error) {
            Logging.error(`Failed to delete database for tenant ${tenant.name}: ${error}`);
            throw error;
        }
    }


    public async  getTenantSettings(subdomain: string): Promise<{ [key: string]: any } | null> {
        const tenant = await this.tenantRepository.findTenant({ subdomain });
        if (!tenant) {
            return null;
        }
        return tenant || null;
    }


    public async getTenantsWithPagination(options?: PaginationOptions<ITenant>): Promise<PaginatedResult<ITenant>> {
        // Set default population for createdBy and updatedBy relations if not provided
        const defaultPopulate = [
            { path: 'createdBy', select: 'name email' },
            { path: 'updatedBy', select: 'name email' },
            { path: 'settings' }
        ];

        const paginationOptions: PaginationOptions<ITenant> = {
            ...options,
            populate: options?.populate || defaultPopulate
        };
        
        return this.tenantRepository.findPaginated(paginationOptions);
    }

    /**
     * Get tenants with pagination and custom filtering/population
     */
    public async getTenantsWithAdvancedPagination(
        filter?: Partial<Record<keyof ITenant | string, any>>,
        page: number = 1,
        limit: number = 10,
        sort?: Record<string, 1 | -1>,
        populate?: string | string[] | { path: string; select?: string; populate?: any }[]
    ): Promise<PaginatedResult<ITenant>> {
        const options: PaginationOptions<ITenant> = {
            filter,
            page,
            limit,
            sort: sort || { createdAt: -1 },
            populate: populate || [
                { path: 'createdBy', select: 'name email' },
                { path: 'updatedBy', select: 'name email' },
                { path: 'settings' }
            ]
        };
        
        return this.tenantRepository.findPaginated(options);
    }
}