/**
 * Application Event Names
 * Centralized registry of all events in the system
 */

export const EVENTS = {
    // User Events
    USER: {
        REGISTERED: 'user.registered',
        LOGIN: 'user.login',
        LOGOUT: 'user.logout',
        PROFILE_UPDATED: 'user.profile.updated',
        PASSWORD_CHANGED: 'user.password.changed',
        DEACTIVATED: 'user.deactivated',
        EMAIL_VERIFIED: 'user.email.verified'
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
    }
} as const;

// Type helper for event names
export type EventNames = typeof EVENTS[keyof typeof EVENTS][keyof typeof EVENTS[keyof typeof EVENTS]];