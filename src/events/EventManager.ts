import AppEventEmitter from './base/EventEmitter';
import { EVENTS } from './types/EventNames';
import {
    UserRegisteredPayload,
    UserLoginPayload,
    UserCreatedPayload,
    UserUpdatedPayload,
    UserDeletedPayload,
    UserPasswordResetPayload,
    TenantCreatedPayload,
    AuthTokenCreatedPayload,
    EmailNotificationPayload,
    AuditActionPayload,
    AddressCreatedPayload,
    AddressUpdatedPayload,
    CrudOperationPayload
} from './types/EventPayloads';
import Logging from '../libraries/logging.library';
import MailService from '../services/mail.service';

export class EventManager {
    private static instance: EventManager;
    private eventEmitter: typeof AppEventEmitter;
    private isInitialized = false;

    private constructor() {
        this.eventEmitter = AppEventEmitter;
    }

    public static getInstance(): EventManager {
        if (!EventManager.instance) {
            EventManager.instance = new EventManager();
        }
        return EventManager.instance;
    }

    /**
     * Initialize event listeners
     */
    public initialize(): void {
        if (this.isInitialized) {
            return;
        }

        this.setupUserEventListeners();
        this.setupTenantEventListeners();
        this.setupAuthEventListeners();
        this.setupSystemEventListeners();
        this.setupNotificationEventListeners();
        this.setupAuditEventListeners();
        this.setupAddressEventListeners();
        this.setupCrudEventListeners();

        this.isInitialized = true;
        Logging.info('Event Manager initialized with all listeners');
    }

    /**
     * User event listeners
     */
    private setupUserEventListeners(): void {
        this.eventEmitter.registerListener<UserRegisteredPayload>(
            EVENTS.USER.REGISTERED,
            async (event) => {
                // Send welcome email
                this.eventEmitter.emitEvent(EVENTS.NOTIFICATION.EMAIL_SEND, {
                    to: event.payload.email,
                    subject: 'Welcome to the Platform!',
                    template: 'welcome',
                    templateData: {
                        name: event.payload.name,
                        isLandlord: event.payload.isLandlord
                    }
                }, event.context);

                // Create audit log
                this.eventEmitter.emitEvent(EVENTS.AUDIT.ACTION_PERFORMED, {
                    action: 'user_registration',
                    resource: 'user',
                    resourceId: event.payload.userId,
                    userId: event.payload.userId,
                    tenantId: event.payload.tenantId,
                    metadata: {
                        email: event.payload.email,
                        isLandlord: event.payload.isLandlord
                    }
                } as AuditActionPayload, event.context);
            }
        );

        this.eventEmitter.registerListener<UserLoginPayload>(
            EVENTS.USER.LOGIN,
            async (event) => {
                // Log successful login
                Logging.info(`User login: ${event.payload.email}`, {
                    userId: event.payload.userId,
                    tenantId: event.payload.tenantId,
                    ipAddress: event.payload.ipAddress
                });

                // Create audit log
                this.eventEmitter.emitEvent(EVENTS.AUDIT.ACTION_PERFORMED, {
                    action: 'user_login',
                    resource: 'user',
                    resourceId: event.payload.userId,
                    userId: event.payload.userId,
                    tenantId: event.payload.tenantId,
                    ipAddress: event.payload.ipAddress,
                    metadata: {
                        loginTime: event.payload.loginTime,
                        userAgent: event.payload.userAgent
                    }
                } as AuditActionPayload, event.context);
            }
        );

        // Enhanced User Events
        this.eventEmitter.registerListener<UserCreatedPayload>(
            EVENTS.USER.CREATED,
            async (event) => {
                Logging.info(`User created: ${event.payload.email}`, {
                    userId: event.payload.userId,
                    tenantId: event.payload.tenantId,
                    createdBy: event.payload.createdBy
                });

                // Send welcome email
                this.eventEmitter.emitEvent(EVENTS.NOTIFICATION.EMAIL_SEND, {
                    to: event.payload.email,
                    subject: 'Welcome! Your account has been created',
                    template: 'user_created',
                    templateData: {
                        name: event.payload.name,
                        email: event.payload.email
                    }
                }, event.context);

                // Create audit log
                this.eventEmitter.emitEvent(EVENTS.AUDIT.ACTION_PERFORMED, {
                    action: 'user_created',
                    resource: 'user',
                    resourceId: event.payload.userId,
                    userId: event.payload.createdBy,
                    tenantId: event.payload.tenantId,
                    metadata: {
                        email: event.payload.email,
                        name: event.payload.name,
                        role: event.payload.role
                    }
                } as AuditActionPayload, event.context);
            }
        );

        this.eventEmitter.registerListener<UserUpdatedPayload>(
            EVENTS.USER.UPDATED,
            async (event) => {
                Logging.info(`User updated: ${event.payload.userId}`, {
                    updatedFields: event.payload.updatedFields,
                    updatedBy: event.payload.updatedBy
                });

                // Create audit log
                this.eventEmitter.emitEvent(EVENTS.AUDIT.ACTION_PERFORMED, {
                    action: 'user_updated',
                    resource: 'user',
                    resourceId: event.payload.userId,
                    userId: event.payload.updatedBy,
                    tenantId: event.payload.tenantId,
                    metadata: {
                        updatedFields: event.payload.updatedFields,
                        previousData: event.payload.previousData,
                        newData: event.payload.newData
                    }
                } as AuditActionPayload, event.context);
            }
        );

        this.eventEmitter.registerListener<UserDeletedPayload>(
            EVENTS.USER.DELETED,
            async (event) => {
                Logging.info(`User deleted: ${event.payload.email}`, {
                    userId: event.payload.userId,
                    deletedBy: event.payload.deletedBy,
                    softDelete: event.payload.softDelete
                });

                // Create audit log
                this.eventEmitter.emitEvent(EVENTS.AUDIT.ACTION_PERFORMED, {
                    action: 'user_deleted',
                    resource: 'user',
                    resourceId: event.payload.userId,
                    userId: event.payload.deletedBy,
                    tenantId: event.payload.tenantId,
                    metadata: {
                        email: event.payload.email,
                        name: event.payload.name,
                        softDelete: event.payload.softDelete
                    }
                } as AuditActionPayload, event.context);
            }
        );

        this.eventEmitter.registerListener<UserPasswordResetPayload>(
            EVENTS.USER.PASSWORD_RESET,
            async (event) => {
                Logging.info(`Password reset for user: ${event.payload.email}`, {
                    userId: event.payload.userId,
                    resetBy: event.payload.resetBy,
                    resetMethod: event.payload.resetMethod
                });

                // Send notification email
                this.eventEmitter.emitEvent(EVENTS.NOTIFICATION.EMAIL_SEND, {
                    to: event.payload.email,
                    subject: 'Password Reset Notification',
                    template: 'password_reset',
                    templateData: {
                        resetMethod: event.payload.resetMethod,
                        resetBy: event.payload.resetBy
                    }
                }, event.context);

                // Create security audit log
                this.eventEmitter.emitEvent(EVENTS.AUDIT.SECURITY_EVENT, {
                    type: 'password_reset' as any,
                    severity: 'medium',
                    description: `Password reset performed by ${event.payload.resetMethod}`,
                    userId: event.payload.userId,
                    tenantId: event.payload.tenantId,
                    metadata: {
                        resetBy: event.payload.resetBy,
                        resetMethod: event.payload.resetMethod
                    }
                }, event.context);
            }
        );
    }

    /**
     * Tenant event listeners
     */
    private setupTenantEventListeners(): void {
        this.eventEmitter.registerListener<TenantCreatedPayload>(
            EVENTS.TENANT.CREATED,
            async (event) => {
                Logging.info(`Tenant created: ${event.payload.name} (${event.payload.subdomain})`);

                // Initialize default settings
                // This would be handled by a separate service
                
                // Send notification to admin
                this.eventEmitter.emitEvent(EVENTS.NOTIFICATION.EMAIL_SEND, {
                    to: 'admin@platform.com', // Replace with actual admin email
                    subject: 'New Tenant Created',
                    template: 'tenant_created',
                    templateData: {
                        tenantName: event.payload.name,
                        subdomain: event.payload.subdomain,
                        createdBy: event.payload.createdBy
                    }
                }, event.context);

                // Create audit log
                this.eventEmitter.emitEvent(EVENTS.AUDIT.ACTION_PERFORMED, {
                    action: 'tenant_creation',
                    resource: 'tenant',
                    resourceId: event.payload.tenantId,
                    userId: event.payload.createdBy,
                    metadata: {
                        tenantName: event.payload.name,
                        subdomain: event.payload.subdomain,
                        databaseName: event.payload.databaseName
                    }
                } as AuditActionPayload, event.context);
            }
        );
    }

    /**
     * Authentication event listeners
     */
    private setupAuthEventListeners(): void {
        this.eventEmitter.registerListener<AuthTokenCreatedPayload>(
            EVENTS.AUTH.TOKEN_CREATED,
            async (event) => {
                Logging.debug(`Auth token created for user: ${event.payload.userId}`, {
                    tokenType: event.payload.type,
                    expiresAt: event.payload.expiresAt
                });
            }
        );
    }

    /**
     * System event listeners
     */
    private setupSystemEventListeners(): void {
        this.eventEmitter.registerListener(
            EVENTS.SYSTEM.EVENT_ERROR,
            async (event) => {
                Logging.error('Event processing error occurred:', {
                    originalEvent: event.payload.originalEvent,
                    originalEventId: event.payload.originalEventId,
                    error: event.payload.error,
                    listenerName: event.payload.listenerName
                });

                // Could implement alerting here
            }
        );
    }

    /**
     * Notification event listeners
     */
    private setupNotificationEventListeners(): void {
        this.eventEmitter.registerListener<EmailNotificationPayload>(
            EVENTS.NOTIFICATION.EMAIL_SEND,
            async (event) => {
                try {
                    // Send via MailService
                    await MailService.send({
                        to: event.payload.to,
                        from: event.payload.from,
                        subject: event.payload.subject,
                        template: event.payload.template,
                        templateData: event.payload.templateData,
                        body: event.payload.body
                    });

                    this.eventEmitter.emitEvent(EVENTS.NOTIFICATION.EMAIL_SENT, {
                        type: 'email',
                        recipient: Array.isArray(event.payload.to) 
                            ? event.payload.to.join(', ') 
                            : event.payload.to,
                        success: true,
                        messageId: `msg_${Date.now()}`
                    }, event.context);

                } catch (error) {
                    this.eventEmitter.emitEvent(EVENTS.NOTIFICATION.EMAIL_FAILED, {
                        type: 'email',
                        recipient: Array.isArray(event.payload.to) 
                            ? event.payload.to.join(', ') 
                            : event.payload.to,
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    }, event.context);
                }
            }
        );
    }

    /**
     * Audit event listeners
     */
    private setupAuditEventListeners(): void {
        this.eventEmitter.registerListener<AuditActionPayload>(
            EVENTS.AUDIT.ACTION_PERFORMED,
            async (event) => {
                // Store audit log in database
                Logging.info('Audit action logged', {
                    action: event.payload.action,
                    resource: event.payload.resource,
                    userId: event.payload.userId,
                    tenantId: event.payload.tenantId,
                    timestamp: event.context.timestamp
                });
                
                // Here you would typically save to an audit log table
            }
        );
    }

    // Email sending handled by MailService now

    /**
     * Get event statistics
     */
    public getStats() {
        return {
            listenerCounts: this.eventEmitter.getEventStats(),
            isInitialized: this.isInitialized
        };
    }

    /**
     * Address event listeners
     */
    private setupAddressEventListeners(): void {
        this.eventEmitter.registerListener<AddressCreatedPayload>(
            EVENTS.ADDRESS.CREATED,
            async (event) => {
                Logging.info(`Address created for user: ${event.payload.userId}`, {
                    addressId: event.payload.addressId,
                    city: event.payload.city,
                    state: event.payload.state
                });
            }
        );

        this.eventEmitter.registerListener<AddressUpdatedPayload>(
            EVENTS.ADDRESS.UPDATED,
            async (event) => {
                Logging.info(`Address updated for user: ${event.payload.userId}`, {
                    addressId: event.payload.addressId
                });
            }
        );
    }

    /**
     * CRUD event listeners
     */
    private setupCrudEventListeners(): void {
        this.eventEmitter.registerListener<CrudOperationPayload>(
            EVENTS.CRUD.OPERATION,
            async (event) => {
                Logging.debug(`CRUD operation: ${event.payload.operation} on ${event.payload.resource}`, {
                    resourceId: event.payload.resourceId,
                    userId: event.payload.userId,
                    tenantId: event.payload.tenantId
                });

                // Could implement metrics collection here
                // Could implement caching invalidation here
                // Could implement real-time notifications here
            }
        );
    }

    /**
     * Cleanup for graceful shutdown
     */
    public cleanup(): void {
        this.eventEmitter.cleanup();
        this.isInitialized = false;
        Logging.info('Event Manager cleaned up');
    }
}

export default EventManager.getInstance();