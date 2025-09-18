import AppEventEmitter, { EventContext } from './base/EventEmitter';
import { EVENTS } from './types/EventNames';
import {
    UserRegisteredPayload,
    UserLoginPayload,
    UserProfileUpdatedPayload,
    UserCreatedPayload,
    UserUpdatedPayload,
    UserDeletedPayload,
    UserPasswordResetPayload,
    TenantCreatedPayload,
    TenantUpdatedPayload,
    AuthTokenCreatedPayload,
    AuthLoginAttemptPayload,
    EmailNotificationPayload,
    AuditActionPayload,
    SecurityEventPayload,
    AddressCreatedPayload,
    AddressUpdatedPayload,
    CrudOperationPayload
} from './types/EventPayloads';

/**
 * Event Service - Convenient methods to emit events
 * This provides a type-safe way to emit events with proper payloads
 */
export class EventService {
    private static instance: EventService;
    private eventEmitter: typeof AppEventEmitter;

    private constructor() {
        this.eventEmitter = AppEventEmitter;
    }

    public static getInstance(): EventService {
        if (!EventService.instance) {
            EventService.instance = new EventService();
        }
        return EventService.instance;
    }

    // User Events
    public emitUserRegistered(payload: UserRegisteredPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.USER.REGISTERED, payload, context);
    }

    public emitUserLogin(payload: UserLoginPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.USER.LOGIN, payload, context);
    }

    public emitUserLogout(userId: string, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.USER.LOGOUT, { userId }, context);
    }

    public emitUserProfileUpdated(payload: UserProfileUpdatedPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.USER.PROFILE_UPDATED, payload, context);
    }

    public emitUserDeactivated(userId: string, reason?: string, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.USER.DEACTIVATED, { userId, reason }, context);
    }

    // Enhanced User Events
    public emitUserCreated(payload: UserCreatedPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.USER.CREATED, payload, context);
    }

    public emitUserUpdated(payload: UserUpdatedPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.USER.UPDATED, payload, context);
    }

    public emitUserDeleted(payload: UserDeletedPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.USER.DELETED, payload, context);
    }

    public emitUserPasswordReset(payload: UserPasswordResetPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.USER.PASSWORD_RESET, payload, context);
    }

    public emitUserViewed(userId: string, viewedBy: string, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.USER.VIEWED, { userId, viewedBy }, context);
    }

    // Tenant Events
    public emitTenantCreated(payload: TenantCreatedPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.TENANT.CREATED, payload, context);
    }

    public emitTenantUpdated(payload: TenantUpdatedPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.TENANT.UPDATED, payload, context);
    }

    public emitTenantDeleted(tenantId: string, deletedBy: string, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.TENANT.DELETED, { tenantId, deletedBy }, context);
    }

    public emitTenantDatabaseCreated(tenantId: string, databaseName: string, success: boolean, error?: string, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.TENANT.DATABASE_CREATED, {
            tenantId,
            databaseName,
            success,
            error
        }, context);
    }

    // Auth Events
    public emitTokenCreated(payload: AuthTokenCreatedPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.AUTH.TOKEN_CREATED, payload, context);
    }

    public emitTokenRevoked(userId: string, tokenId?: string, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.AUTH.TOKEN_REVOKED, { userId, tokenId }, context);
    }

    public emitLoginAttempt(payload: AuthLoginAttemptPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(
            payload.success ? EVENTS.AUTH.LOGIN_SUCCESS : EVENTS.AUTH.LOGIN_FAILED,
            payload,
            context
        );
    }

    // System Events
    public emitDatabaseConnection(connectionName: string, databaseName: string, status: 'connected' | 'disconnected' | 'error', error?: string, context?: Partial<EventContext>): boolean {
        const eventName = status === 'connected' 
            ? EVENTS.SYSTEM.DATABASE_CONNECTED 
            : EVENTS.SYSTEM.DATABASE_DISCONNECTED;
        
        return this.eventEmitter.emitEvent(eventName, {
            connectionName,
            databaseName,
            status,
            error
        }, context);
    }

    public emitServerStarted(port: number, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.SYSTEM.SERVER_STARTED, { port }, context);
    }

    public emitServerShutdown(reason?: string, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.SYSTEM.SERVER_SHUTDOWN, { reason }, context);
    }

    // Notification Events
    public emitEmailNotification(payload: EmailNotificationPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.NOTIFICATION.EMAIL_SEND, payload, context);
    }

    // Audit Events
    public emitAuditAction(payload: AuditActionPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.AUDIT.ACTION_PERFORMED, payload, context);
    }

    public emitSecurityEvent(payload: SecurityEventPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.AUDIT.SECURITY_EVENT, payload, context);
    }

    // Address Events
    public emitAddressCreated(payload: AddressCreatedPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.ADDRESS.CREATED, payload, context);
    }

    public emitAddressUpdated(payload: AddressUpdatedPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.ADDRESS.UPDATED, payload, context);
    }

    public emitAddressDeleted(addressId: string, userId: string, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.ADDRESS.DELETED, { addressId, userId }, context);
    }

    // Generic CRUD Event
    public emitCrudOperation(payload: CrudOperationPayload, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(EVENTS.CRUD.OPERATION, payload, context);
    }

    // Convenience method to emit custom events
    public emitCustomEvent(eventName: string, payload: any, context?: Partial<EventContext>): boolean {
        return this.eventEmitter.emitEvent(eventName, payload, context);
    }

    // Emit multiple events efficiently (synchronously in a tight loop)
    public batchEmit(events: Array<{ name: string; payload: any; context?: Partial<EventContext> }>): number {
        let count = 0;
        for (const e of events) {
            if (this.eventEmitter.emitEvent(e.name, e.payload, e.context)) {
                count++;
            }
        }
        return count;
    }

    // Conditionally emit an event
    public emitIf(condition: boolean, eventName: string, payload: any, context?: Partial<EventContext>): boolean {
        return condition ? this.eventEmitter.emitEvent(eventName, payload, context) : false;
    }

    // Helper to create event context from request
    public createContextFromRequest(req: any): Partial<EventContext> {
        return {
            userId: req.userId || req.user?.id,
            tenantId: req.tenant?.id || req.tenant?._id,
            subdomain: req.subdomain
        };
    }

    // Helper to emit audit trail for any operation
    public emitAuditTrail(
        action: string,
        resource: string,
        resourceId: string,
        userId: string,
        metadata?: any,
        context?: Partial<EventContext>
    ): boolean {
        return this.emitAuditAction({
            action,
            resource,
            resourceId,
            userId,
            tenantId: context?.tenantId,
            metadata
        }, context);
    }

    // Helper to emit both CRUD and audit events
    public emitCrudWithAudit(
        operation: 'create' | 'read' | 'update' | 'delete',
        resource: string,
        resourceId: string,
        userId: string,
        data?: any,
        previousData?: any,
        context?: Partial<EventContext>
    ): boolean {
        // Emit CRUD event
        this.emitCrudOperation({
            operation,
            resource,
            resourceId,
            userId,
            tenantId: context?.tenantId,
            data,
            previousData
        }, context);

        // Emit audit event
        return this.emitAuditTrail(
            `${resource}_${operation}`,
            resource,
            resourceId,
            userId,
            { operation, data, previousData },
            context
        );
    }
}

export default EventService.getInstance();