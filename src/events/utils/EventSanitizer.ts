import { EventPayload } from '../base/EventEmitter';

const SENSITIVE_KEYS = new Set([
  'password',
  'newPassword',
  'oldPassword',
  'token',
  'accessToken',
  'refreshToken',
  'creditCard',
  'cardNumber',
  'cvv',
  'otp',
]);

export class EventSanitizer {
  public static sanitizePayload<T extends EventPayload>(payload: T): T {
    if (!payload || typeof payload !== 'object') return payload;

    // Recursively clone and sanitize
    const sanitize = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      if (Array.isArray(obj)) return obj.map(sanitize);
      if (typeof obj !== 'object') return obj;

      const out: any = Array.isArray(obj) ? [] : {};
      for (const [key, value] of Object.entries(obj)) {
        if (SENSITIVE_KEYS.has(key)) {
          // Drop or mask sensitive values
          out[key] = '[REDACTED]';
        } else {
          out[key] = sanitize(value);
        }
      }
      return out;
    };

    return sanitize(payload);
  }
}

export default EventSanitizer;
