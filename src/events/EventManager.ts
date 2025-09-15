import AppEventEmitter from './base/EventEmitter';
import { EVENTS } from './types/EventNames';
import {
    UserRegisteredPayload,
    UserLoginPayload,
    TenantCreatedPayload,
    AuthTokenCreatedPayload,
    EmailNotificationPayload,
    AuditActionPayload
} from './types/EventPayloads';
import Logging from '../libraries/logging.library';

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
                    // Simulate email sending - replace with actual email service
                    await this.sendEmail(event.payload);
                    
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

    /**
     * Simulate email sending (replace with actual email service)
     */
    private async sendEmail(payload: EmailNotificationPayload): Promise<void> {
        return new Promise((resolve) => {
            // Simulate async email sending
            setTimeout(() => {
                Logging.info(`Email sent to: ${payload.to}`, {
                    subject: payload.subject,
                    template: payload.template
                });
                resolve();
            }, 100);
        });
    }

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
     * Cleanup for graceful shutdown
     */
    public cleanup(): void {
        this.eventEmitter.cleanup();
        this.isInitialized = false;
        Logging.info('Event Manager cleaned up');
    }
}

export default EventManager.getInstance();