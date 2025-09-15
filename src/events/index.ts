export { AppEventEmitter, AppEvent, EventPayload, EventContext } from './base/EventEmitter';
export { EVENTS, EventNames } from './types/EventNames';
export * from './types/EventPayloads';
export { EventManager } from './EventManager';

// Re-export the default instances for convenience
import AppEventEmitter from './base/EventEmitter';
import EventManager from './EventManager';

export { AppEventEmitter as eventEmitter };
export { EventManager as eventManager };

// Initialize event system
export const initializeEventSystem = () => {
    EventManager.initialize();
    return { eventEmitter: AppEventEmitter, eventManager: EventManager };
};