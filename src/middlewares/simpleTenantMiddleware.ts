import { Request, Response, NextFunction } from 'express';
import { Connection } from 'mongoose';
import { ITenant } from '../models/tenant.model';
import { TenantConnectionService } from '../services/tenantConnection.service';
import { errorResponse } from '../utils/errorResponse';
import Logging from '../libraries/logging.library';
import mongoose from 'mongoose';

// Extend Express Request interface
declare global {
    namespace Express {
        interface Request {
            tenant?: ITenant;
            tenantConnection?: Connection;
            subdomain?: string;
            isLandlord?: boolean; // Flag to indicate landlord request
        }
    }
}

export class SimpleTenantMiddleware {
    private static instance: SimpleTenantMiddleware;
    private connectionService: TenantConnectionService;

    private constructor() {
        this.connectionService = TenantConnectionService.getInstance();
    }

    public static getInstance(): SimpleTenantMiddleware {
        if (!SimpleTenantMiddleware.instance) {
            SimpleTenantMiddleware.instance = new SimpleTenantMiddleware();
        }
        return SimpleTenantMiddleware.instance;
    }

    /**
     * Middleware to resolve tenant and set up database connection
     * If no tenant subdomain is provided, treat as landlord request (main database)
     */
    public resolveTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Extract subdomain from request
            const subdomain = this.extractSubdomain(req);
            
            if (!subdomain) {
                // No tenant subdomain provided - treat as landlord request
                req.isLandlord = true;
                req.tenantConnection = mongoose.connection; // Use main database connection
                req.subdomain = 'landlord';
                
                Logging.info('Landlord request detected - using main database');
                next();
                return;
            }

            // Get tenant connection and info from master database
            const { connection, tenant } = await this.connectionService.getTenantConnection(subdomain);

            // Set tenant context in request
            req.tenant = tenant;
            req.tenantConnection = connection;
            req.subdomain = subdomain;
            req.isLandlord = false;

            Logging.info(`Tenant context resolved: ${tenant.name} (${subdomain})`);
            next();
            
        } catch (error) {
            Logging.error(`Tenant resolution failed: ${error}`);
            
            if ((error as Error).message.includes('Tenant not found')) {
                errorResponse.sendError({
                    res,
                    message: 'Tenant not found',
                    statusCode: 404
                });
            } else {
                errorResponse.sendError({
                    res,
                    message: 'Failed to resolve tenant context',
                    statusCode: 500
                });
            }
        }
    };

    /**
     * Optional tenant middleware - doesn't fail if no tenant found
     * Always allows landlord requests
     */
    public optionalTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const subdomain = this.extractSubdomain(req);
            
            if (!subdomain) {
                // No tenant subdomain - landlord request
                req.isLandlord = true;
                req.tenantConnection = mongoose.connection;
                req.subdomain = 'landlord';
                Logging.info('Optional tenant resolution: Landlord request detected');
                next();
                return;
            }

            try {
                const { connection, tenant } = await this.connectionService.getTenantConnection(subdomain);
                req.tenant = tenant;
                req.tenantConnection = connection;
                req.subdomain = subdomain;
                req.isLandlord = false;
                Logging.info(`Optional tenant resolution: ${tenant.name} (${subdomain})`);
            } catch (error) {
                // Tenant not found or connection failed - fall back to landlord
                Logging.warning(`Tenant resolution failed, falling back to landlord: ${error}`);
                req.isLandlord = true;
                req.tenantConnection = mongoose.connection;
                req.subdomain = 'landlord';
            }
            
            next();
        } catch (error) {
            // Don't fail if tenant resolution fails in optional mode
            Logging.warning(`Optional tenant resolution failed: ${error}`);
            req.isLandlord = true;
            req.tenantConnection = mongoose.connection;
            req.subdomain = 'landlord';
            next();
        }
    };

    /**
     * Extract subdomain from request (multiple methods)
     */
    private extractSubdomain(req: Request): string | null {
        // Method 1: From custom header (recommended for API)
        const headerSubdomain = req.headers['x-tenant-subdomain'] as string;
        if (headerSubdomain) {
            return headerSubdomain.toLowerCase();
        }

        // Method 2: From subdomain in Host header (e.g., acme.yourdomain.com)
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

        // Method 4: From request body
        const bodySubdomain = req.body?.subdomain as string;
        if (bodySubdomain) {
            return bodySubdomain.toLowerCase();
        }

        return null;
    }
}

export default SimpleTenantMiddleware.getInstance();
