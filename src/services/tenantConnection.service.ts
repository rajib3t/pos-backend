import mongoose, { Connection } from 'mongoose';
import { dbConfig } from '../config';
import Logging from '../libraries/logging.library';
import { ITenant } from '../models/tenant.model';
import { TenantRepository } from '../repositories/tenant.repository';

export class TenantConnectionService {
    private static instance: TenantConnectionService;
    private connections: Map<string, Connection> = new Map();
    private tenantRepository: TenantRepository;
    private readonly connectionTTL = 30 * 60 * 1000; // 30 minutes TTL

    private constructor() {
        this.tenantRepository = new TenantRepository();
        
        // Cleanup unused connections every 10 minutes
        setInterval(() => {
            this.cleanupConnections();
        }, 10 * 60 * 1000);
    }

    public static getInstance(): TenantConnectionService {
        if (!TenantConnectionService.instance) {
            TenantConnectionService.instance = new TenantConnectionService();
        }
        return TenantConnectionService.instance;
    }

    /**
     * Get tenant connection by subdomain
     * This checks master database for tenant info, then creates/reuses connection
     */
    public async getTenantConnection(subdomain: string): Promise<{ connection: Connection; tenant: ITenant }> {
        try {
            // Check if we already have a connection for this tenant
            const existingConnection = this.connections.get(subdomain);
            if (existingConnection && existingConnection.readyState === 1) {
                // Get tenant info from master database
                const tenant = await this.getTenantBySubdomain(subdomain);
                if (!tenant) {
                    throw new Error(`Tenant not found for subdomain: ${subdomain}`);
                }
                
                Logging.info(`Reusing existing connection for tenant: ${subdomain}`);
                return { connection: existingConnection, tenant };
            }

            // Fetch tenant info from master database
            const tenant = await this.getTenantBySubdomain(subdomain);
            if (!tenant) {
                throw new Error(`Tenant not found for subdomain: ${subdomain}`);
            }

            // Create new connection using tenant credentials
            const connection = await this.createTenantConnection(tenant);
            
            // Store connection for reuse
            this.connections.set(subdomain, connection);
            
            Logging.info(`Created new connection for tenant: ${subdomain}`);
            return { connection, tenant };

        } catch (error) {
            Logging.error(`Failed to get tenant connection for ${subdomain}: ${error}`);
            throw error;
        }
    }

    /**
     * Get tenant info from master database by subdomain
     */
    private async getTenantBySubdomain(subdomain: string): Promise<ITenant | null> {
        try {
            const tenants = await this.tenantRepository.findAll();
            return tenants.find(tenant => 
                tenant.subdomain.toLowerCase() === subdomain.toLowerCase()
            ) || null;
        } catch (error) {
            Logging.error(`Error fetching tenant by subdomain ${subdomain}: ${error}`);
            throw error;
        }
    }

    /**
     * Create database connection for tenant
     */
    private async createTenantConnection(tenant: ITenant): Promise<Connection> {
        const dbHost = dbConfig.host || "localhost";
        const dbPort = dbConfig.port || 27017;
        const user = dbConfig.username || "admin";
        const password = dbConfig.password || "admin";
        const tenantDbUri = `mongodb://${user}:${password}@${dbHost}:${dbPort}/${tenant.databaseName}?authSource=admin`;

        try {
            const connection = mongoose.createConnection(tenantDbUri, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });

            await connection.asPromise();
            
            Logging.info(`Connected to tenant database: ${tenant.databaseName}`);
            return connection;
            
        } catch (error) {
            Logging.error(`Failed to connect to tenant database ${tenant.databaseName}: ${error}`);
            throw new Error(`Database connection failed for tenant: ${tenant.subdomain}`);
        }
    }

    /**
     * Close connection for specific tenant
     */
    public async closeTenantConnection(subdomain: string): Promise<void> {
        const connection = this.connections.get(subdomain);
        if (connection) {
            await connection.close();
            this.connections.delete(subdomain);
            Logging.info(`Closed connection for tenant: ${subdomain}`);
        }
    }

    /**
     * Cleanup expired connections
     */
    private async cleanupConnections(): Promise<void> {
        const keysToDelete: string[] = [];

        for (const [key, connection] of this.connections.entries()) {
            if (connection.readyState !== 1) {
                keysToDelete.push(key);
            }
        }

        for (const key of keysToDelete) {
            await this.closeTenantConnection(key);
        }

        if (keysToDelete.length > 0) {
            Logging.info(`Cleaned up ${keysToDelete.length} expired tenant connections`);
        }
    }

    /**
     * Close all connections
     */
    public async closeAllConnections(): Promise<void> {
        const promises = Array.from(this.connections.keys()).map(key => 
            this.closeTenantConnection(key)
        );
        await Promise.all(promises);
        Logging.info('All tenant connections closed');
    }

    /**
     * Get active connections count
     */
    public getActiveConnectionsCount(): number {
        return this.connections.size;
    }
}

export default TenantConnectionService.getInstance();
