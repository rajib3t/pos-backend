import { EventEmitter as NodeEventEmitter } from 'events';
import Logging from '../../libraries/logging.library';

export interface EventPayload {
    [key: string]: any;
}

export interface EventContext {
    userId?: string;
    tenantId?: string;
    subdomain?: string;
    timestamp: Date;
    eventId: string;
}

export interface AppEvent<T extends EventPayload = EventPayload> {
    name: string;
    payload: T;
    context: EventContext;
}

export class AppEventEmitter extends NodeEventEmitter {
    private static instance: AppEventEmitter;

    private constructor() {
        super();
        this.setMaxListeners(100); // Increase default limit for high-traffic scenarios
    }

    public static getInstance(): AppEventEmitter {
        if (!AppEventEmitter.instance) {
            AppEventEmitter.instance = new AppEventEmitter();
        }
        return AppEventEmitter.instance;
    }

    /**
     * Emit an application event with structured payload
     */
    public emitEvent<T extends EventPayload>(
        eventName: string, 
        payload: T, 
        context: Partial<EventContext> = {}
    ): boolean {
        const eventContext: EventContext = {
            timestamp: new Date(),
            eventId: this.generateEventId(),
            ...context
        };

        const event: AppEvent<T> = {
            name: eventName,
            payload,
            context: eventContext
        };

        Logging.debug(`Emitting event: ${eventName}`, {
            eventId: eventContext.eventId,
            payload: payload,
            context: eventContext
        });

        return this.emit(eventName, event);
    }

    /**
     * Register event listener with error handling
     */
    public registerListener<T extends EventPayload>(
        eventName: string,
        listener: (event: AppEvent<T>) => void | Promise<void>,
        options?: { once?: boolean }
    ): this {
        const wrappedListener = async (event: AppEvent<T>) => {
            try {
                Logging.debug(`Processing event: ${eventName}`, {
                    eventId: event.context.eventId,
                    listenerName: listener.name || 'anonymous'
                });

                await listener(event);

                Logging.debug(`Event processed successfully: ${eventName}`, {
                    eventId: event.context.eventId
                });
            } catch (error) {
                Logging.error(`Event listener error for ${eventName}:`, error);
                
                // Emit error event for monitoring
                this.emitEvent('system.event.error', {
                    originalEvent: eventName,
                    originalEventId: event.context.eventId,
                    error: error instanceof Error ? error.message : String(error),
                    listenerName: listener.name || 'anonymous'
                }, event.context);
            }
        };

        if (options?.once) {
            this.once(eventName, wrappedListener);
        } else {
            this.on(eventName, wrappedListener);
        }

        return this;
    }

    /**
     * Generate unique event ID
     */
    private generateEventId(): string {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get event statistics
     */
    public getEventStats(): { [eventName: string]: number } {
        const stats: { [eventName: string]: number } = {};
        
        for (const eventName of this.eventNames()) {
            stats[String(eventName)] = this.listenerCount(eventName);
        }
        
        return stats;
    }

    /**
     * Remove all listeners for cleanup
     */
    public cleanup(): void {
        this.removeAllListeners();
        Logging.info('Event emitter cleaned up - all listeners removed');
    }
}

export default AppEventEmitter.getInstance();