import { Request, Response, NextFunction } from 'express';
import { ITenant } from '../models/tenant.model';
import { TenantRepository } from '../repositories/tenant.repository';
import { TenantConnectionManager } from '../database/tenantConnection';
import { errorResponse } from '../utils/errorResponse';
import { Connection } from 'mongoose';
import Logging from '../libraries/logging.library';

// Extend Express Request interface to include tenant context
declare global {
    namespace Express {
        interface Request {
            tenant?: ITenant;
            tenantConnection?: Connection;
            subdomain?: string;
        }
    }
}

export class TenantMiddleware {
    private static instance: TenantMiddleware;
    private tenantRepository: TenantRepository;
    private connectionManager: TenantConnectionManager;

    private constructor() {
        this.tenantRepository = new TenantRepository();
        this.connectionManager = TenantConnectionManager.getInstance();
    }

    public static getInstance(): TenantMiddleware {
        if (!TenantMiddleware.instance) {
            TenantMiddleware.instance = new TenantMiddleware();
        }
        return TenantMiddleware.instance;
    }

    /**
     * Middleware to resolve tenant from subdomain and set up database connection
     */
    public resolveTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Extract subdomain from various sources
            const subdomain = this.extractSubdomain(req);
            
            if (!subdomain) {
                errorResponse.sendError({
                    res,
                    message: 'Subdomain is required for tenant identification',
                    statusCode: 400
                });
                return;
            }

            // Find tenant by subdomain
            const tenant = await this.findTenantBySubdomain(subdomain);
            
            if (!tenant) {
                errorResponse.sendError({
                    res,
                    message: 'Tenant not found',
                    statusCode: 404
                });
                return;
            }

            // Get tenant-specific database connection
            const tenantConnection = await this.connectionManager.getTenantConnection(tenant);

            // Set tenant context in request
            req.tenant = tenant;
            req.tenantConnection = tenantConnection;
            req.subdomain = subdomain;

            Logging.info(`Tenant context set for: ${tenant.name} (${subdomain})`);
            
            next();
        } catch (error) {
            Logging.error(`Tenant resolution failed: ${error}`);
            errorResponse.sendError({
                res,
                message: 'Failed to resolve tenant context',
                statusCode: 500
            });
        }
    };

    /**
     * Extract subdomain from request
     */
    private extractSubdomain(req: Request): string | null {
        // Method 1: From custom header
        const headerSubdomain = req.headers['x-tenant-subdomain'] as string;
        if (headerSubdomain) {
            return headerSubdomain.toLowerCase();
        }

        // Method 2: From subdomain in Host header
        const host = req.headers.host || req.hostname;
        if (host) {
            const hostParts = host.split('.');
            if (hostParts.length > 2) {
                return hostParts[0].toLowerCase();
            }
        }

        // Method 3: From query parameter
        const querySubdomain = req.query.subdomain as string;
        if (querySubdomain) {
            return querySubdomain.toLowerCase();
        }

        // Method 4: From request body (for API calls)
        const bodySubdomain = req.body?.subdomain as string;
        if (bodySubdomain) {
            return bodySubdomain.toLowerCase();
        }

        return null;
    }

    /**
     * Find tenant by subdomain
     */
    private async findTenantBySubdomain(subdomain: string): Promise<ITenant | null> {
        try {
            // Using the main database connection to find tenant info
            const tenants = await this.tenantRepository.findAll();
            return tenants.find(tenant => tenant.subdomain.toLowerCase() === subdomain.toLowerCase()) || null;
        } catch (error) {
            Logging.error(`Failed to find tenant by subdomain ${subdomain}: ${error}`);
            throw error;
        }
    }

    /**
     * Middleware to ensure tenant context exists
     */
    public requireTenant = (req: Request, res: Response, next: NextFunction): void => {
        if (!req.tenant || !req.tenantConnection) {
            errorResponse.sendError({
                res,
                message: 'Tenant context is required for this operation',
                statusCode: 400
            });
            return;
        }
        next();
    };

    /**
     * Middleware for operations that don't require tenant context (like tenant creation)
     */
    public optionalTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const subdomain = this.extractSubdomain(req);
            
            if (subdomain) {
                const tenant = await this.findTenantBySubdomain(subdomain);
                if (tenant) {
                    const tenantConnection = await this.connectionManager.getTenantConnection(tenant);
                    req.tenant = tenant;
                    req.tenantConnection = tenantConnection;
                    req.subdomain = subdomain;
                }
            }
            
            next();
        } catch (error) {
            // Don't fail if tenant resolution fails in optional mode
            Logging.warning(`Optional tenant resolution failed: ${error}`);
            next();
        }
    };
}

export default TenantMiddleware.getInstance();
