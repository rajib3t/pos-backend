import EventService from '../events/EventService';
import Logging from '../libraries/logging.library';

export interface EventDecoratorOptions {
    eventName?: string;
    resource?: string;
    operation?: 'create' | 'read' | 'update' | 'delete';
    emitAudit?: boolean;
    emitCrud?: boolean;
    extractResourceId?: (args: any[], result: any) => string;
    extractData?: (args: any[], result: any) => any;
    extractPreviousData?: (args: any[], result: any) => any;
    condition?: (args: any[], result: any) => boolean;
}

/**
 * Decorator to automatically emit events when controller methods are called
 */
export function EmitEvent(options: EventDecoratorOptions) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            let result: any;
            let error: any;

            try {
                // Execute the original method
                result = await method.apply(this, args);
                
                // Emit events only if the method executed successfully
                if (result && (!options.condition || options.condition(args, result))) {
                    emitEventsFromDecorator(args, result, options);
                }
                
                return result;
            } catch (err) {
                error = err;
                throw err;
            }
        };

        return descriptor;
    };
}

/**
 * Decorator specifically for user operations
 */
export function EmitUserEvent(operation: 'create' | 'read' | 'update' | 'delete', options?: Partial<EventDecoratorOptions>) {
    return EmitEvent({
        resource: 'user',
        operation,
        emitAudit: true,
        emitCrud: true,
        ...options
    });
}

/**
 * Decorator specifically for tenant operations
 */
export function EmitTenantEvent(operation: 'create' | 'read' | 'update' | 'delete', options?: Partial<EventDecoratorOptions>) {
    return EmitEvent({
        resource: 'tenant',
        operation,
        emitAudit: true,
        emitCrud: true,
        ...options
    });
}

/**
 * Decorator for audit-only events (no CRUD event)
 */
export function EmitAuditEvent(action: string, resource: string, options?: Partial<EventDecoratorOptions>) {
    return EmitEvent({
        eventName: `${resource}.${action}`,
        resource,
        emitAudit: true,
        emitCrud: false,
        ...options
    });
}

/**
 * Helper function to emit events from decorator
 */
function emitEventsFromDecorator(args: any[], result: any, options: EventDecoratorOptions): void {
    try {
        // Extract request object (usually first argument in controller methods)
        const req = args[0];
        const context = EventService.createContextFromRequest(req);
        const userId = req?.userId || 'system';

        // Extract resource ID
        const resourceId = options.extractResourceId 
            ? options.extractResourceId(args, result)
            : extractDefaultResourceId(args, result);

        // Extract data
        const data = options.extractData 
            ? options.extractData(args, result)
            : extractDefaultData(args, result);

        // Extract previous data
        const previousData = options.extractPreviousData 
            ? options.extractPreviousData(args, result)
            : undefined;

        // Emit custom event if specified
        if (options.eventName) {
            EventService.emitCustomEvent(options.eventName, {
                resourceId,
                data,
                previousData,
                userId,
                tenantId: context.tenantId
            }, context);
        }

        // Emit CRUD and audit events
        if (options.resource && options.operation) {
            if (options.emitCrud && options.emitAudit) {
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
                if (options.emitCrud) {
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

                if (options.emitAudit) {
                    EventService.emitAuditTrail(
                        `${options.resource}_${options.operation}`,
                        options.resource,
                        resourceId,
                        userId,
                        { operation: options.operation, data, previousData },
                        context
                    );
                }
            }
        }
    } catch (error) {
        Logging.error('Error in event decorator:', error);
    }
}

/**
 * Default resource ID extraction
 */
function extractDefaultResourceId(args: any[], result: any): string {
    const req = args[0];
    
    // Try to get ID from URL params
    if (req?.params?.id) return req.params.id;
    if (req?.params?.userId) return req.params.userId;
    if (req?.params?.tenantId) return req.params.tenantId;
    
    // Try to get ID from result
    if (result?._id) return result._id;
    if (result?.id) return result.id;
    if (result?.data?._id) return result.data._id;
    if (result?.data?.id) return result.data.id;
    
    return 'unknown';
}

/**
 * Default data extraction
 */
function extractDefaultData(args: any[], result: any): any {
    const req = args[0];
    
    // For POST/PUT requests, use request body
    if (req?.method === 'POST' || req?.method === 'PUT' || req?.method === 'PATCH') {
        return req.body;
    }
    
    // For other requests, use result data
    return result?.data || result;
}

/**
 * Specific decorators for common user operations
 */
export const EmitUserCreated = () => EmitUserEvent('create', {
    extractResourceId: (args, result) => result?.data?._id || result?._id || 'unknown'
});

export const EmitUserUpdated = () => EmitUserEvent('update', {
    extractResourceId: (args, result) => args[0]?.params?.userId || result?.data?._id || 'unknown',
    extractPreviousData: (args, result) => args[0]?.previousUserData // Requires controller to set this
});

export const EmitUserDeleted = () => EmitUserEvent('delete', {
    extractResourceId: (args, result) => args[0]?.params?.userId || 'unknown'
});

export const EmitUserViewed = () => EmitUserEvent('read', {
    extractResourceId: (args, result) => args[0]?.params?.userId || result?.data?._id || 'unknown'
});
