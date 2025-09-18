/**
 * Example Event Listeners
 * Demonstrates various event handling patterns for the application
 */

import AppEventEmitter from './base/EventEmitter';
import { EVENTS } from './types/EventNames';
import {
    UserRegisteredPayload,
    TenantCreatedPayload,
    AuthLoginAttemptPayload,
    EmailNotificationPayload
} from './types/EventPayloads';
import Logging from '../libraries/logging.library';
import { notificationConfig } from '../config';

export class ExampleEventListeners {
    private eventEmitter: typeof AppEventEmitter;

    constructor() {
        this.eventEmitter = AppEventEmitter;
        this.registerListeners();
    }

    private registerListeners(): void {
        this.registerUserEventListeners();
        this.registerSecurityEventListeners();
        this.registerAnalyticsEventListeners();
        this.registerNotificationEventListeners();
    }

    /**
     * User-related event listeners
     */
    private registerUserEventListeners(): void {
        // Welcome sequence for new users
        this.eventEmitter.registerListener<UserRegisteredPayload>(
            EVENTS.USER.REGISTERED,
            async (event) => {
                const { userId, email, name, isLandlord } = event.payload;
                
                Logging.info(`Starting welcome sequence for new user: ${email}`);

                // Send welcome email series
                const welcomeEmails = [
                    {
                        delay: 0,
                        subject: `Welcome to our platform, ${name}!`,
                        template: 'welcome',
                        templateData: { name, isLandlord }
                    },
                    {
                        delay: 24 * 60 * 60 * 1000, // 24 hours
                        subject: 'Getting started guide',
                        template: 'getting_started',
                        templateData: { name, isLandlord }
                    },
                    {
                        delay: 7 * 24 * 60 * 60 * 1000, // 7 days
                        subject: 'Tips and tricks',
                        template: 'tips_and_tricks',
                        templateData: { name, isLandlord }
                    }
                ];

                for (const emailData of welcomeEmails) {
                    setTimeout(() => {
                        this.eventEmitter.emitEvent(EVENTS.NOTIFICATION.EMAIL_SEND, {
                            to: email,
                            subject: emailData.subject,
                            template: emailData.template,
                            templateData: emailData.templateData,
                            priority: 'normal'
                        } as EmailNotificationPayload, event.context);
                    }, emailData.delay);
                }

                // Create user profile setup reminder
                if (!isLandlord) {
                    setTimeout(() => {
                        this.eventEmitter.emitEvent('user.profile.setup_reminder', {
                            userId,
                            email,
                            name
                        }, event.context);
                    }, 2 * 60 * 60 * 1000); // 2 hours
                }
            }
        );

        // Profile setup reminders
        this.eventEmitter.registerListener(
            'user.profile.setup_reminder',
            async (event) => {
                Logging.info(`Sending profile setup reminder to: ${event.payload.email}`);
                
                this.eventEmitter.emitEvent(EVENTS.NOTIFICATION.EMAIL_SEND, {
                    to: event.payload.email,
                    subject: 'Complete your profile setup',
                    template: 'profile_setup_reminder',
                    templateData: {
                        name: event.payload.name,
                        setupUrl: `${process.env.FRONTEND_URL}/profile/setup`
                    },
                    priority: 'low'
                } as EmailNotificationPayload, event.context);
            }
        );
    }

    /**
     * Security-related event listeners
     */
    private registerSecurityEventListeners(): void {
        // Failed login attempt monitoring
        this.eventEmitter.registerListener<AuthLoginAttemptPayload>(
            EVENTS.AUTH.LOGIN_FAILED,
            async (event) => {
                const { email, ipAddress, errorReason } = event.payload;
                
                Logging.warn(`Failed login attempt for ${email} from ${ipAddress}: ${errorReason}`);

                // Check for suspicious activity (multiple failed attempts)
                // In a real implementation, you'd store this in Redis or database
                // For now, just emit a security event for critical failures
                
                if (errorReason === 'Invalid password') {
                    this.eventEmitter.emitEvent(EVENTS.AUDIT.SECURITY_EVENT, {
                        type: 'failed_auth',
                        severity: 'medium',
                        description: `Multiple failed login attempts detected for ${email}`,
                        metadata: {
                            email,
                            ipAddress,
                            errorReason,
                            timestamp: event.context.timestamp
                        },
                        ipAddress
                    }, event.context);
                }
            }
        );

        // Security event alerting
        this.eventEmitter.registerListener(
            EVENTS.AUDIT.SECURITY_EVENT,
            async (event) => {
                const { type, severity, description } = event.payload;
                
                if (severity === 'high' || severity === 'critical') {
                    // Send immediate alert to security team
                    this.eventEmitter.emitEvent(EVENTS.NOTIFICATION.EMAIL_SEND, {
                        to: notificationConfig.securityEmail,
                        subject: `SECURITY ALERT: ${type.toUpperCase()}`,
                        body: description,
                        priority: 'high'
                    } as EmailNotificationPayload, event.context);
                }
            }
        );
    }

    /**
     * Analytics and metrics event listeners
     */
    private registerAnalyticsEventListeners(): void {
        // User activity tracking
        this.eventEmitter.registerListener(
            EVENTS.USER.LOGIN,
            async (event) => {
                // Track user engagement metrics
                Logging.info(`User activity: ${event.payload.email} logged in`, {
                    userId: event.payload.userId,
                    tenantId: event.context.tenantId,
                    timestamp: event.context.timestamp
                });

                // In a real implementation, you'd send this to an analytics service
                // like Google Analytics, Mixpanel, or your own metrics collection
            }
        );

        // Tenant growth tracking
        this.eventEmitter.registerListener<TenantCreatedPayload>(
            EVENTS.TENANT.CREATED,
            async (event) => {
                const { name, subdomain, createdBy } = event.payload;
                
                Logging.info(`Business metrics: New tenant created`, {
                    tenantName: name,
                    subdomain,
                    createdBy,
                    timestamp: event.context.timestamp
                });

                // Track tenant creation in analytics
                // Send notification to business team about growth
                this.eventEmitter.emitEvent(EVENTS.NOTIFICATION.EMAIL_SEND, {
                    to: notificationConfig.businessEmail,
                    subject: 'New Tenant Alert',
                    template: 'new_tenant_business',
                    templateData: {
                        tenantName: name,
                        subdomain,
                        createdAt: event.context.timestamp
                    },
                    priority: 'low'
                } as EmailNotificationPayload, event.context);
            }
        );
    }

    /**
     * Notification-related event listeners
     */
    private registerNotificationEventListeners(): void {
        // Email delivery status tracking
        this.eventEmitter.registerListener(
            EVENTS.NOTIFICATION.EMAIL_SENT,
            async (event) => {
                Logging.info(`Email delivered successfully to: ${event.payload.recipient}`, {
                    messageId: event.payload.messageId
                });
                
                // Update delivery statistics
                // Track email engagement metrics
            }
        );

        this.eventEmitter.registerListener(
            EVENTS.NOTIFICATION.EMAIL_FAILED,
            async (event) => {
                Logging.error(`Email delivery failed to: ${event.payload.recipient}`, {
                    error: event.payload.error
                });

                // Retry logic for critical emails
                // Alert administrators about delivery issues
                if (event.payload.error?.includes('bounce') || event.payload.error?.includes('invalid')) {
                    this.eventEmitter.emitEvent(EVENTS.NOTIFICATION.EMAIL_SEND, {
                        to: notificationConfig.adminEmail,
                        subject: 'Email Delivery Issue',
                        body: `Failed to deliver email to ${event.payload.recipient}: ${event.payload.error}`,
                        priority: 'normal'
                    } as EmailNotificationPayload, event.context);
                }
            }
        );
    }

    /**
     * Custom business logic event listener example
     */
    public registerCustomBusinessLogic(): void {
        // Example: Tenant onboarding workflow
        this.eventEmitter.registerListener<TenantCreatedPayload>(
            EVENTS.TENANT.CREATED,
            async (event) => {
                const { tenantId, name, subdomain, createdBy } = event.payload;
                
                // Start tenant onboarding sequence
                const onboardingSteps = [
                    { delay: 0, step: 'setup_admin_user' },
                    { delay: 60000, step: 'configure_settings' }, // 1 minute
                    { delay: 300000, step: 'send_setup_guide' }   // 5 minutes
                ];

                for (const step of onboardingSteps) {
                    setTimeout(() => {
                        this.eventEmitter.emitEvent(`tenant.onboarding.${step.step}`, {
                            tenantId,
                            name,
                            subdomain,
                            createdBy
                        }, event.context);
                    }, step.delay);
                }
            }
        );

        // Handle onboarding steps
        this.eventEmitter.registerListener(
            'tenant.onboarding.setup_admin_user',
            async (event) => {
                Logging.info(`Onboarding: Setting up admin user for tenant ${event.payload.name}`);
                // Create default admin user, roles, permissions
            }
        );

        this.eventEmitter.registerListener(
            'tenant.onboarding.configure_settings',
            async (event) => {
                Logging.info(`Onboarding: Configuring default settings for tenant ${event.payload.name}`);
                // Set up default tenant settings, preferences
            }
        );

        this.eventEmitter.registerListener(
            'tenant.onboarding.send_setup_guide',
            async (event) => {
                Logging.info(`Onboarding: Sending setup guide for tenant ${event.payload.name}`);
                // Send comprehensive setup documentation
            }
        );
    }
}

// Export instance for use in application
export default new ExampleEventListeners();