import mongoose, { Connection } from 'mongoose';
import { dbConfig } from '../config';
import Logging from '../libraries/logging.library';
import { ITenant } from '../models/tenant.model';
import { log } from 'console';

export interface ITenantConnection {
    connection: Connection;
    tenant: ITenant;
    lastUsed: Date;
}

export class TenantConnectionManager {
    private static instance: TenantConnectionManager;
    private connections: Map<string, ITenantConnection> = new Map();
    private readonly maxConnections = 50; // Maximum number of concurrent connections
    private readonly connectionTTL = 30 * 60 * 1000; // 30 minutes TTL

    private constructor() {
        // Cleanup unused connections every 10 minutes
        setInterval(() => {
            this.cleanupConnections();
        }, 10 * 60 * 1000);
    }

    public static getInstance(): TenantConnectionManager {
        if (!TenantConnectionManager.instance) {
            TenantConnectionManager.instance = new TenantConnectionManager();
        }
        return TenantConnectionManager.instance;
    }

    /**
     * Get or create a database connection for a specific tenant
     */
    public async getTenantConnection(tenant: ITenant): Promise<Connection> {
        const connectionKey = tenant.subdomain;
        
        // Check if connection already exists and is valid
        const existingConnection = this.connections.get(connectionKey);
        if (existingConnection && existingConnection.connection.readyState === 1) {
            existingConnection.lastUsed = new Date();
            return existingConnection.connection;
        }

        // Create new connection
        const connection = await this.createTenantConnection(tenant);
        
        // Store connection
        this.connections.set(connectionKey, {
            connection,
            tenant,
            lastUsed: new Date()
        });

        // Cleanup old connections if we exceed max limit
        if (this.connections.size > this.maxConnections) {
            await this.cleanupOldestConnections();
        }

        return connection;
    }

    /**
     * Create a new database connection for a tenant
     */
    private async createTenantConnection(tenant: ITenant): Promise<Connection> {
        const dbHost = dbConfig.host || "localhost";
        const dbPort = dbConfig.port || 27017;
        const user = dbConfig.username || "admin";
        const password = dbConfig.password || "admin";
        const tenantDbUri = `mongodb://${user}:${password}@${dbHost}:${dbPort}/${tenant.databaseName}?authSource=admin`;
        Logging.info(`Creating connection to tenant DB URI: ${tenantDbUri}`);
        try {
            const connection = mongoose.createConnection(tenantDbUri, {
                maxPoolSize: 10, // Maintain up to 10 socket connections
                serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
                socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
            });

            await connection.asPromise();
            
            Logging.info(`Connected to tenant database: ${tenant.databaseName} for subdomain: ${tenant.subdomain}`);
            
            return connection;
        } catch (error) {
            Logging.error(`Failed to connect to tenant database ${tenant.databaseName}: ${error}`);
            throw new Error(`Database connection failed for tenant: ${tenant.subdomain}`);
        }
    }

    /**
     * Close connection for a specific tenant
     */
    public async closeTenantConnection(subdomain: string): Promise<void> {
        const connection = this.connections.get(subdomain);
        if (connection) {
            await connection.connection.close();
            this.connections.delete(subdomain);
            Logging.info(`Closed connection for tenant: ${subdomain}`);
        }
    }

    /**
     * Cleanup expired connections
     */
    private async cleanupConnections(): Promise<void> {
        const now = new Date();
        const expiredKeys: string[] = [];

        for (const [key, connection] of this.connections.entries()) {
            const timeDiff = now.getTime() - connection.lastUsed.getTime();
            if (timeDiff > this.connectionTTL || connection.connection.readyState !== 1) {
                expiredKeys.push(key);
            }
        }

        for (const key of expiredKeys) {
            await this.closeTenantConnection(key);
        }

        if (expiredKeys.length > 0) {
            Logging.info(`Cleaned up ${expiredKeys.length} expired tenant connections`);
        }
    }

    /**
     * Cleanup oldest connections when limit is exceeded
     */
    private async cleanupOldestConnections(): Promise<void> {
        const sortedConnections = Array.from(this.connections.entries())
            .sort(([, a], [, b]) => a.lastUsed.getTime() - b.lastUsed.getTime());

        const connectionsToRemove = sortedConnections.slice(0, 10); // Remove 10 oldest
        
        for (const [key] of connectionsToRemove) {
            await this.closeTenantConnection(key);
        }
    }

    /**
     * Get all active connections count
     */
    public getActiveConnectionsCount(): number {
        return this.connections.size;
    }

    /**
     * Close all tenant connections
     */
    public async closeAllConnections(): Promise<void> {
        const promises = Array.from(this.connections.keys()).map(key => 
            this.closeTenantConnection(key)
        );
        await Promise.all(promises);
        Logging.info('All tenant connections closed');
    }
}

export default TenantConnectionManager.getInstance();
