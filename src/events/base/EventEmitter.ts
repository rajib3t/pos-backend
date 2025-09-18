import { EventEmitter as NodeEventEmitter } from 'events';
import Logging from '../../libraries/logging.library';
import EventSanitizer from '../utils/EventSanitizer';
import Metrics from '../utils/EventMetrics';

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
    private readonly recentEvents: Map<string, AppEvent> = new Map();
    private readonly maxRecentEvents = 1000; // bounded cache for replay/debugging
    private readonly filters: Array<(event: AppEvent) => boolean> = [];

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

        // Apply filters before emission; if any filter returns false, skip emission
        for (const filter of this.filters) {
            try {
                const allowed = filter(event);
                if (!allowed) {
                    Logging.debug(`Event filtered out: ${eventName}`, {
                        eventId: eventContext.eventId
                    });
                    return false;
                }
            } catch (err) {
                Logging.error(`Error in event filter for ${eventName}:`, err);
                // On filter error, fail-safe to allow event to proceed
                continue;
            }
        }

        // Sanitize payload for logs only; do not mutate actual event payload
        const sanitizedForLog = EventSanitizer.sanitizePayload(payload);

        Logging.debug(`Emitting event: ${eventName}`, {
            eventId: eventContext.eventId,
            payload: sanitizedForLog,
            context: eventContext
        });

        // Store in recent events (bounded)
        this.recentEvents.set(eventContext.eventId, event);
        if (this.recentEvents.size > this.maxRecentEvents) {
            // remove oldest entry
            const firstKey = this.recentEvents.keys().next().value as string | undefined;
            if (firstKey) this.recentEvents.delete(firstKey);
        }

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

                const start = Date.now();
                await listener(event);
                const duration = Date.now() - start;
                Metrics.recordEventEmission(event.name, duration);

                Logging.debug(`Event processed successfully: ${eventName}`, {
                    eventId: event.context.eventId
                });
            } catch (error) {
                Logging.error(`Event listener error for ${eventName}:`, error);
                Metrics.recordError(event.name);
                
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
     * Add an event filter. Filters are executed before emission.
     * If any filter returns false, the event will not be emitted.
     */
    public addEventFilter(filter: (event: AppEvent) => boolean): void {
        this.filters.push(filter);
        Logging.info('Event filter added', { totalFilters: this.filters.length });
    }

    /**
     * Remove a previously added filter (by reference).
     */
    public removeEventFilter(filter: (event: AppEvent) => boolean): void {
        const idx = this.filters.indexOf(filter);
        if (idx >= 0) {
            this.filters.splice(idx, 1);
            Logging.info('Event filter removed', { totalFilters: this.filters.length });
        }
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
     * Retrieve a recent event by its ID (from bounded cache)
     */
    public getEventById(eventId: string): AppEvent | undefined {
        return this.recentEvents.get(eventId);
    }

    /**
     * Replay a recent event by its ID, re-emitting it to current listeners
     */
    public replayEvent(eventId: string): boolean {
        const evt = this.recentEvents.get(eventId);
        if (!evt) {
            Logging.warn('Attempted to replay missing event', { eventId });
            return false;
        }
        Logging.info('Replaying event', { eventId, name: evt.name });
        return this.emit(evt.name, evt);
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