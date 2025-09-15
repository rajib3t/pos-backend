import { EventPayload, EventContext } from '../base/EventEmitter';

// User Event Payloads
export interface UserRegisteredPayload extends EventPayload {
    userId: string;
    email: string;
    name: string;
    tenantId?: string;
    isLandlord: boolean;
}

export interface UserLoginPayload extends EventPayload {
    userId: string;
    email: string;
    loginTime: Date;
    ipAddress?: string;
    userAgent?: string;
    tenantId?: string;
}

export interface UserProfileUpdatedPayload extends EventPayload {
    userId: string;
    previousData: any;
    newData: any;
    updatedFields: string[];
}

// Tenant Event Payloads
export interface TenantCreatedPayload extends EventPayload {
    tenantId: string;
    name: string;
    subdomain: string;
    databaseName: string;
    databaseUser: string;
    createdBy: string;
}

export interface TenantDatabaseCreatedPayload extends EventPayload {
    tenantId: string;
    databaseName: string;
    databaseUser: string;
    success: boolean;
    error?: string;
}

export interface TenantUpdatedPayload extends EventPayload {
    tenantId: string;
    previousData: any;
    newData: any;
    updatedFields: string[];
    updatedBy: string;
}

// Auth Event Payloads
export interface AuthTokenCreatedPayload extends EventPayload {
    userId: string;
    tokenId?: string;
    expiresAt: Date;
    type: 'access' | 'refresh';
}

export interface AuthLoginAttemptPayload extends EventPayload {
    email: string;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
    tenantId?: string;
    errorReason?: string;
}

// System Event Payloads
export interface SystemEventErrorPayload extends EventPayload {
    originalEvent: string;
    originalEventId: string;
    error: string;
    listenerName: string;
}

export interface DatabaseConnectionPayload extends EventPayload {
    connectionName: string;
    databaseName: string;
    status: 'connected' | 'disconnected' | 'error';
    error?: string;
}

// Notification Event Payloads
export interface EmailNotificationPayload extends EventPayload {
    to: string | string[];
    from?: string;
    subject: string;
    body: string;
    template?: string;
    templateData?: any;
    priority?: 'low' | 'normal' | 'high';
}

export interface NotificationSentPayload extends EventPayload {
    type: 'email' | 'sms' | 'push';
    recipient: string;
    success: boolean;
    error?: string;
    messageId?: string;
}

// Audit Event Payloads
export interface AuditActionPayload extends EventPayload {
    action: string;
    resource: string;
    resourceId?: string;
    userId: string;
    tenantId?: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
}

export interface SecurityEventPayload extends EventPayload {
    type: 'suspicious_login' | 'failed_auth' | 'permission_denied' | 'data_breach';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    userId?: string;
    tenantId?: string;
    ipAddress?: string;
    metadata?: any;
}