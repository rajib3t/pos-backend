import EventService from '../EventService';
import Logging from '../../libraries/logging.library';

export type HookType = 'pre' | 'post';
export type OperationType = 'create' | 'read' | 'update' | 'delete';

export interface HookContext {
    resource: string;
    operation: OperationType;
    userId: string;
    tenantId?: string;
    data?: any;
    previousData?: any;
    result?: any;
    metadata?: any;
}

export interface EventHook {
    name: string;
    type: HookType;
    resource: string;
    operation?: OperationType;
    priority: number; // Lower number = higher priority
    handler: (context: HookContext) => Promise<void> | void;
    condition?: (context: HookContext) => boolean;
}

/**
 * Event Hooks System - Allows registering pre/post operation hooks
 * This enables business logic to be executed before or after operations
 */
export class EventHooksManager {
    private static instance: EventHooksManager;
    private hooks: Map<string, EventHook[]> = new Map();

    private constructor() {}

    public static getInstance(): EventHooksManager {
        if (!EventHooksManager.instance) {
            EventHooksManager.instance = new EventHooksManager();
        }
        return EventHooksManager.instance;
    }

    /**
     * Register a new event hook
     */
    public registerHook(hook: EventHook): void {
        const key = this.getHookKey(hook.type, hook.resource, hook.operation);
        
        if (!this.hooks.has(key)) {
            this.hooks.set(key, []);
        }
        
        const hooks = this.hooks.get(key)!;
        hooks.push(hook);
        
        // Sort by priority (lower number = higher priority)
        hooks.sort((a, b) => a.priority - b.priority);
        
        Logging.debug(`Registered ${hook.type} hook for ${hook.resource}`, {
            hookName: hook.name,
            priority: hook.priority
        });
    }

    /**
     * Execute pre-operation hooks
     */
    public async executePreHooks(context: HookContext): Promise<void> {
        await this.executeHooks('pre', context);
    }

    /**
     * Execute post-operation hooks
     */
    public async executePostHooks(context: HookContext): Promise<void> {
        await this.executeHooks('post', context);
    }

    /**
     * Execute hooks for a specific type and context
     */
    private async executeHooks(type: HookType, context: HookContext): Promise<void> {
        const specificKey = this.getHookKey(type, context.resource, context.operation);
        const generalKey = this.getHookKey(type, context.resource);
        
        // Get hooks for specific operation and general resource hooks
        const specificHooks = this.hooks.get(specificKey) || [];
        const generalHooks = this.hooks.get(generalKey) || [];
        
        // Combine and sort by priority
        const allHooks = [...specificHooks, ...generalHooks]
            .sort((a, b) => a.priority - b.priority);

        for (const hook of allHooks) {
            try {
                // Check condition if specified
                if (hook.condition && !hook.condition(context)) {
                    continue;
                }

                Logging.debug(`Executing ${type} hook: ${hook.name}`, {
                    resource: context.resource,
                    operation: context.operation
                });

                await hook.handler(context);
            } catch (error) {
                Logging.error(`Error executing ${type} hook: ${hook.name}`, error);
                
                // Emit error event but don't stop execution
                EventService.emitCustomEvent('hook.error', {
                    hookName: hook.name,
                    hookType: type,
                    resource: context.resource,
                    operation: context.operation,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }

    /**
     * Generate hook key for storage
     */
    private getHookKey(type: HookType, resource: string, operation?: OperationType): string {
        return operation ? `${type}:${resource}:${operation}` : `${type}:${resource}`;
    }

    /**
     * Remove a hook by name
     */
    public removeHook(hookName: string): boolean {
        for (const [key, hooks] of this.hooks.entries()) {
            const index = hooks.findIndex(hook => hook.name === hookName);
            if (index !== -1) {
                hooks.splice(index, 1);
                if (hooks.length === 0) {
                    this.hooks.delete(key);
                }
                return true;
            }
        }
        return false;
    }

    /**
     * Get all registered hooks
     */
    public getHooks(): { [key: string]: EventHook[] } {
        const result: { [key: string]: EventHook[] } = {};
        for (const [key, hooks] of this.hooks.entries()) {
            result[key] = [...hooks];
        }
        return result;
    }

    /**
     * Clear all hooks
     */
    public clearHooks(): void {
        this.hooks.clear();
        Logging.info('All event hooks cleared');
    }
}

/**
 * Decorator to automatically execute hooks around controller methods
 */
export function WithEventHooks(resource: string, operation: OperationType) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        const hooksManager = EventHooksManager.getInstance();

        descriptor.value = async function (...args: any[]) {
            const req = args[0]; // Assuming first argument is request
            const context: HookContext = {
                resource,
                operation,
                userId: req?.userId || 'system',
                tenantId: req?.tenant?._id || req?.params?.tenantId,
                data: req?.body,
                metadata: {
                    method: propertyName,
                    timestamp: new Date()
                }
            };

            try {
                // Execute pre-hooks
                await hooksManager.executePreHooks(context);

                // Execute original method
                const result = await method.apply(this, args);
                
                // Add result to context for post-hooks
                context.result = result;

                // Execute post-hooks
                await hooksManager.executePostHooks(context);

                return result;
            } catch (error) {
                // Execute error hooks if needed
                Logging.error(`Error in method ${propertyName} with hooks:`, error);
                throw error;
            }
        };

        return descriptor;
    };
}

export default EventHooksManager.getInstance();
