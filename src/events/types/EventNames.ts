/**
 * Application Event Names
 * Centralized registry of all events in the system
 */

export const EVENTS = {
    // User Events
    USER: {
        REGISTERED: 'user.registered',
        CREATED: 'user.created',
        LOGIN: 'user.login',
        LOGOUT: 'user.logout',
        PROFILE_UPDATED: 'user.profile.updated',
        UPDATED: 'user.updated',
        PASSWORD_CHANGED: 'user.password.changed',
        PASSWORD_RESET: 'user.password.reset',
        DEACTIVATED: 'user.deactivated',
        DELETED: 'user.deleted',
        EMAIL_VERIFIED: 'user.email.verified',
        VIEWED: 'user.viewed'
    },

    // Tenant Events
    TENANT: {
        CREATED: 'tenant.created',
        UPDATED: 'tenant.updated',
        DELETED: 'tenant.deleted',
        DATABASE_CREATED: 'tenant.database.created',
        DATABASE_DELETED: 'tenant.database.deleted',
        CONNECTION_ESTABLISHED: 'tenant.connection.established',
        CONNECTION_FAILED: 'tenant.connection.failed',
        SETTINGS_UPDATED: 'tenant.settings.updated'
    },

    // Authentication Events
    AUTH: {
        TOKEN_CREATED: 'auth.token.created',
        TOKEN_REFRESHED: 'auth.token.refreshed',
        TOKEN_REVOKED: 'auth.token.revoked',
        LOGIN_ATTEMPT: 'auth.login.attempt',
        LOGIN_SUCCESS: 'auth.login.success',
        LOGIN_FAILED: 'auth.login.failed',
        LOGOUT: 'auth.logout'
    },

    // System Events
    SYSTEM: {
        EVENT_ERROR: 'system.event.error',
        DATABASE_CONNECTED: 'system.database.connected',
        DATABASE_DISCONNECTED: 'system.database.disconnected',
        SERVER_STARTED: 'system.server.started',
        SERVER_SHUTDOWN: 'system.server.shutdown'
    },

    // Notification Events
    NOTIFICATION: {
        EMAIL_SEND: 'notification.email.send',
        EMAIL_SENT: 'notification.email.sent',
        EMAIL_FAILED: 'notification.email.failed',
        SMS_SEND: 'notification.sms.send',
        PUSH_SEND: 'notification.push.send'
    },

    // Audit Events
    AUDIT: {
        ACTION_PERFORMED: 'audit.action.performed',
        DATA_ACCESSED: 'audit.data.accessed',
        SECURITY_EVENT: 'audit.security.event'
    },

    // Address Events
    ADDRESS: {
        CREATED: 'address.created',
        UPDATED: 'address.updated',
        DELETED: 'address.deleted'
    },

    // Generic CRUD Events
    CRUD: {
        OPERATION: 'crud.operation'
    }
} as const;

// Type helper for event names
export type EventNames = typeof EVENTS[keyof typeof EVENTS][keyof typeof EVENTS[keyof typeof EVENTS]];

// Helper to get all user events
export const USER_EVENTS = EVENTS.USER;
export const TENANT_EVENTS = EVENTS.TENANT;
export const AUTH_EVENTS = EVENTS.AUTH;
export const SYSTEM_EVENTS = EVENTS.SYSTEM;
export const NOTIFICATION_EVENTS = EVENTS.NOTIFICATION;
export const AUDIT_EVENTS = EVENTS.AUDIT;
export const ADDRESS_EVENTS = EVENTS.ADDRESS;
export const CRUD_EVENTS = EVENTS.CRUD;