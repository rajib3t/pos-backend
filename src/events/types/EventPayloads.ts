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
    updatedBy?: string;
    tenantId?: string;
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

// Enhanced User Event Payloads
export interface UserCreatedPayload extends EventPayload {
    userId: string;
    email: string;
    name: string;
    mobile?: string;
    role?: string;
    tenantId?: string;
    // Sub-account (tenant) info to enrich notifications
    tenantName?: string;
    subdomain?: string;
    createdBy: string;
}

export interface UserUpdatedPayload extends EventPayload {
    userId: string;
    previousData: any;
    newData: any;
    updatedFields: string[];
    updatedBy: string;
    tenantId?: string;
}

export interface UserDeletedPayload extends EventPayload {
    userId: string;
    email: string;
    name: string;
    deletedBy: string;
    tenantId?: string;
    softDelete?: boolean;
}

export interface UserPasswordResetPayload extends EventPayload {
    userId: string;
    email: string;
    resetBy: string;
    tenantId?: string;
    resetMethod: 'admin' | 'self' | 'forgot_password';
}

// Address Event Payloads
export interface AddressCreatedPayload extends EventPayload {
    addressId: string;
    userId: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    tenantId?: string;
}

export interface AddressUpdatedPayload extends EventPayload {
    addressId: string;
    userId: string;
    previousData: any;
    newData: any;
    tenantId?: string;
}

// Generic CRUD Event Payloads
export interface CrudOperationPayload extends EventPayload {
    operation: 'create' | 'read' | 'update' | 'delete';
    resource: string;
    resourceId: string;
    userId: string;
    tenantId?: string;
    data?: any;
    previousData?: any;
    metadata?: any;
}