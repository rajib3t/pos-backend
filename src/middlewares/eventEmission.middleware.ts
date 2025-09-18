import { Request, Response, NextFunction } from 'express';
import EventService from '../events/EventService';
import Logging from '../libraries/logging.library';

export interface EventEmissionOptions {
    resource: string;
    operation?: 'create' | 'read' | 'update' | 'delete';
    skipAudit?: boolean;
    skipCrud?: boolean;
    customEventName?: string;
    extractResourceId?: (req: Request, res: Response) => string;
    extractData?: (req: Request, res: Response) => any;
    extractPreviousData?: (req: Request, res: Response) => any;
}

/**
 * Middleware to automatically emit events for controller operations
 * This middleware should be applied after the main operation but before sending response
 */
export class EventEmissionMiddleware {
    private static instance: EventEmissionMiddleware;

    private constructor() {}

    public static getInstance(): EventEmissionMiddleware {
        if (!EventEmissionMiddleware.instance) {
            EventEmissionMiddleware.instance = new EventEmissionMiddleware();
        }
        return EventEmissionMiddleware.instance;
    }

    /**
     * Create middleware function for automatic event emission
     */
    public createEventMiddleware(options: EventEmissionOptions) {
        return (req: Request, res: Response, next: NextFunction) => {
            // Store original res.json to intercept successful responses
            const originalJson = res.json.bind(res);
            
            res.json = (data: any) => {
                try {
                    // Only emit events for successful operations (2xx status codes)
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        this.emitEvents(req, res, data, options);
                    }
                } catch (error) {
                    Logging.error('Error in event emission middleware:', error);
                }
                
                return originalJson(data);
            };

            next();
        };
    }

    /**
     * Emit events based on the operation
     */
    private emitEvents(req: Request, res: Response, responseData: any, options: EventEmissionOptions): void {
        const context = EventService.createContextFromRequest(req);
        const userId = req.userId || 'system';
        
        // Extract resource ID
        const resourceId = options.extractResourceId 
            ? options.extractResourceId(req, res)
            : this.defaultExtractResourceId(req, responseData);

        // Extract data
        const data = options.extractData 
            ? options.extractData(req, res)
            : this.defaultExtractData(req, responseData);

        // Extract previous data (for updates)
        const previousData = options.extractPreviousData 
            ? options.extractPreviousData(req, res)
            : undefined;

        // Emit custom event if specified
        if (options.customEventName) {
            EventService.emitCustomEvent(options.customEventName, {
                resourceId,
                data,
                previousData,
                userId,
                tenantId: context.tenantId
            }, context);
        }

        // Emit CRUD and audit events if not skipped
        if (options.operation && !options.skipCrud && !options.skipAudit) {
            EventService.emitCrudWithAudit(
                options.operation,
                options.resource,
                resourceId,
                userId,
                data,
                previousData,
                context
            );
        } else {
            // Emit individual events if needed
            if (options.operation && !options.skipCrud) {
                EventService.emitCrudOperation({
                    operation: options.operation,
                    resource: options.resource,
                    resourceId,
                    userId,
                    tenantId: context.tenantId,
                    data,
                    previousData
                }, context);
            }

            if (!options.skipAudit) {
                EventService.emitAuditTrail(
                    `${options.resource}_${options.operation || 'action'}`,
                    options.resource,
                    resourceId,
                    userId,
                    { operation: options.operation, data, previousData },
                    context
                );
            }
        }
    }

    /**
     * Default method to extract resource ID from request or response
     */
    private defaultExtractResourceId(req: Request, responseData: any): string {
        // Try to get ID from URL params
        if (req.params.id) return req.params.id;
        if (req.params.userId) return req.params.userId;
        if (req.params.tenantId) return req.params.tenantId;
        
        // Try to get ID from response data
        if (responseData?.data?._id) return responseData.data._id;
        if (responseData?.data?.id) return responseData.data.id;
        if (responseData?._id) return responseData._id;
        if (responseData?.id) return responseData.id;
        
        return 'unknown';
    }

    /**
     * Default method to extract data from request or response
     */
    private defaultExtractData(req: Request, responseData: any): any {
        // For POST/PUT requests, use request body
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
            return req.body;
        }
        
        // For GET requests, use response data
        return responseData?.data || responseData;
    }

    /**
     * Convenience methods for common operations
     */
    public forCreate(resource: string, options?: Partial<EventEmissionOptions>) {
        return this.createEventMiddleware({
            resource,
            operation: 'create',
            ...options
        });
    }

    public forRead(resource: string, options?: Partial<EventEmissionOptions>) {
        return this.createEventMiddleware({
            resource,
            operation: 'read',
            ...options
        });
    }

    public forUpdate(resource: string, options?: Partial<EventEmissionOptions>) {
        return this.createEventMiddleware({
            resource,
            operation: 'update',
            ...options
        });
    }

    public forDelete(resource: string, options?: Partial<EventEmissionOptions>) {
        return this.createEventMiddleware({
            resource,
            operation: 'delete',
            ...options
        });
    }
}

export default EventEmissionMiddleware.getInstance();
