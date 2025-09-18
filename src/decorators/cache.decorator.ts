import Logging from '../libraries/logging.library';
import CacheService from '../services/cache.service';

export interface CacheDecoratorOptions {
    ttl?: number;
    prefix?: string;
    keyGenerator?: (...args: any[]) => string;
}

/**
 * Method decorator for caching return values
 */
export function Cached(options: CacheDecoratorOptions = {}) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const cacheKey = options.keyGenerator 
                ? options.keyGenerator(...args)
                : `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}` ;

            try {
                // Try to get from cache first
                const cachedResult = await CacheService.get(cacheKey, {
                    prefix: options.prefix || 'method',
                    ttl: options.ttl
                });

                if (cachedResult !== null) {
                    Logging.info(`Method cache HIT for: ${cacheKey}` );
                    return cachedResult;
                }

                // Execute original method
                const result = await method.apply(this, args);
                
                // Cache the result
                await CacheService.set(cacheKey, result, {
                    prefix: options.prefix || 'method',
                    ttl: options.ttl
                });

                Logging.info(`Method cache SET for: ${cacheKey}` );
                return result;
            } catch (error) {
                Logging.error(`Method cache error for ${cacheKey}: ${error}` );
                // Fall back to original method
                return method.apply(this, args);
            }
        };

        return descriptor;
    };
}

/**
 * Method decorator for cache invalidation
 */
export function InvalidateCache(patterns: string[] | ((...args: any[]) => string[])) {
    return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;

        descriptor.value = async function (...args: any[]) {
            const result = await method.apply(this, args);
            
            try {
                const invalidationPatterns = typeof patterns === 'function' 
                    ? patterns(...args)
                    : patterns;
                
                for (const pattern of invalidationPatterns) {
                    const cleared = await CacheService.clear(pattern);
                    Logging.info(`Method invalidated ${cleared} cache entries for pattern: ${pattern}` );
                }
            } catch (error) {
                Logging.error(`Method cache invalidation error: ${error}` );
            }

            return result;
        };

        return descriptor;
    };
}
