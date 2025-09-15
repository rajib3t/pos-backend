# Event-Driven Architecture Implementation

## Overview

Your codebase has been successfully transformed from a traditional request-response pattern to an **event-driven architecture**. This transformation maintains backward compatibility while adding powerful asynchronous processing capabilities.

## Key Benefits Achieved

### 1. **Asynchronous Processing**
- User registration now triggers welcome emails, audit logs, and analytics tracking without blocking the response
- Tenant creation initiates database setup, notifications, and onboarding workflows asynchronously
- Authentication events enable security monitoring and user activity tracking

### 2. **Loose Coupling**
- Controllers no longer need to know about all side effects (emails, logging, analytics)
- Services can focus on their core responsibility
- New functionality can be added by simply creating event listeners

### 3. **Scalability**
- Events can be processed in background workers
- Easy to add caching, queuing, or external service integrations
- Better resource utilization through async processing

### 4. **Observability**
- Comprehensive audit trails through event logging
- Security monitoring through failed login tracking
- Business metrics through tenant and user activity events

## Architecture Components

### 1. **Core Event Infrastructure**

#### `src/events/base/EventEmitter.ts`
- Custom event emitter extending Node.js EventEmitter
- Structured event payloads with context information
- Error handling and event statistics
- Automatic event ID generation

#### `src/events/types/EventNames.ts`
- Centralized event name registry
- Type-safe event naming
- Organized by domain (USER, TENANT, AUTH, SYSTEM, etc.)

#### `src/events/types/EventPayloads.ts`
- TypeScript interfaces for all event payloads
- Ensures type safety across event emissions
- Clear data contracts for event consumers

### 2. **Event Management**

#### `src/events/EventManager.ts`
- Singleton pattern for centralized event management
- Automatic listener registration
- Built-in error handling and logging
- Graceful shutdown support

#### `src/events/EventService.ts`
- Type-safe wrapper for event emissions
- Convenient methods for common events
- Request context extraction helpers
- Custom event support

### 3. **Event Listeners**

#### Built-in Listeners
- **User Events**: Welcome emails, profile setup reminders, audit logging
- **Tenant Events**: Admin notifications, onboarding workflows, analytics
- **Auth Events**: Security monitoring, token tracking, login analytics
- **System Events**: Error handling, database connections, server lifecycle
- **Notification Events**: Email delivery tracking, retry logic

#### `src/events/ExampleEventListeners.ts`
- Demonstrates advanced event handling patterns
- Security monitoring and alerting
- User engagement tracking
- Business metrics collection
- Tenant onboarding workflows

## Integration Points

### 1. **Controllers Updated**

#### User Registration (`src/controllers/auth/register.controller.ts`)
```typescript
// Emit user registration event after successful creation
EventService.emitUserRegistered({
    userId: user._id as string,
    email: user.email,
    name: user.name,
    tenantId: req.tenant?._id as string,
    isLandlord: !!req.isLandlord
}, EventService.createContextFromRequest(req));
```

#### Tenant Management (`src/controllers/tenant.controller.ts`)
```typescript
// Emit events for tenant creation, updates, and deletion
EventService.emitTenantCreated({ ... });
EventService.emitTenantUpdated({ ... });
EventService.emitTenantDeleted({ ... });
```

#### Authentication (`src/controllers/auth/login.controller.ts`)
```typescript
// Emit login success/failure events
EventService.emitUserLogin({ ... });
EventService.emitLoginAttempt({ ... });
EventService.emitTokenCreated({ ... });
```

### 2. **Server Integration (`src/server.ts`)**
- Event system initialization on server startup
- Server lifecycle event emissions
- Graceful shutdown with event cleanup

### 3. **Middleware Integration (`src/middlewares/tenantMiddleware.ts`)**
- Tenant connection events
- Context establishment tracking

## Event Flow Examples

### User Registration Flow
1. **Request**: POST /auth/register
2. **Response**: 201 Created (immediate)
3. **Events Triggered**:
   - `user.registered` → Welcome email sent
   - `audit.action.performed` → Registration logged
   - `notification.email.send` → Email queued
   - `notification.email.sent` → Delivery confirmed

### Tenant Creation Flow
1. **Request**: POST /tenants/create
2. **Response**: 201 Created (immediate)
3. **Events Triggered**:
   - `tenant.created` → Admin notification
   - `tenant.database.created` → Database setup confirmed
   - `audit.action.performed` → Creation logged
   - `tenant.onboarding.setup_admin_user` → Admin user setup
   - `tenant.onboarding.configure_settings` → Default settings
   - `tenant.onboarding.send_setup_guide` → Setup documentation

## Configuration and Usage

### 1. **Initialization**
The event system is automatically initialized when the server starts:
```typescript
import { initializeEventSystem } from './events';
const { eventEmitter, eventManager } = initializeEventSystem();
```

### 2. **Emitting Events**
Use the EventService for type-safe event emissions:
```typescript
import EventService from './events/EventService';

// Emit with automatic context
EventService.emitUserRegistered(payload, EventService.createContextFromRequest(req));

// Emit custom events
EventService.emitCustomEvent('my.custom.event', { data: 'value' });
```

### 3. **Creating Custom Listeners**
```typescript
import AppEventEmitter from './events/base/EventEmitter';
import { EVENTS } from './events/types/EventNames';

AppEventEmitter.registerListener(
    EVENTS.USER.REGISTERED,
    async (event) => {
        // Your custom logic here
        console.log('New user registered:', event.payload.email);
    }
);
```

## Monitoring and Observability

### 1. **Event Statistics**
```typescript
import EventManager from './events/EventManager';
const stats = EventManager.getStats();
console.log('Active listeners:', stats.listenerCounts);
```

### 2. **Logging Integration**
All events are automatically logged with:
- Event name and ID
- Payload data (sanitized)
- Context information (user, tenant, timestamp)
- Processing status and errors

### 3. **Error Handling**
- Failed event listeners don't crash the application
- Errors are logged and can trigger alert events
- Automatic retry mechanisms can be implemented

## Backward Compatibility

The transformation maintains full backward compatibility:
- All existing API endpoints work unchanged
- Response times remain fast (events are async)
- No breaking changes to existing functionality
- Existing tests should continue to pass

## Future Enhancements

### 1. **Queue Integration**
- Replace in-memory events with Redis/RabbitMQ
- Persistent event storage for reliability
- Distributed processing across multiple servers

### 2. **External Integrations**
- Webhook support for external systems
- Third-party service integrations (Stripe, SendGrid, etc.)
- Real-time notifications via WebSockets

### 3. **Advanced Patterns**
- Event sourcing for audit trails
- CQRS (Command Query Responsibility Segregation)
- Saga patterns for complex workflows

### 4. **Performance Optimization**
- Event batching for high-volume scenarios
- Circuit breakers for failing services
- Rate limiting for event processing

## Troubleshooting

### Common Issues

1. **Events Not Firing**
   - Check if EventManager is initialized
   - Verify event names match constants in EventNames.ts
   - Ensure listeners are registered before events are emitted

2. **Memory Leaks**
   - Use `{ once: true }` for one-time listeners
   - Clean up listeners on server shutdown
   - Monitor event emitter statistics

3. **Performance Issues**
   - Avoid heavy processing in event listeners
   - Use background queues for intensive operations
   - Implement proper error handling to prevent blocking

### Debugging

Enable debug logging to see event flow:
```typescript
import Logging from './libraries/logging.library';
Logging.configure({ level: LogLevel.DEBUG });
```

## Conclusion

Your application now benefits from a robust event-driven architecture that:
- ✅ Maintains all existing functionality
- ✅ Adds powerful asynchronous processing
- ✅ Improves scalability and maintainability
- ✅ Provides comprehensive observability
- ✅ Supports future growth and integrations

The event system is production-ready and can scale with your application's needs.