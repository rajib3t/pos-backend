import { Request, Response, NextFunction } from 'express';
import CacheService from '../services/cache.service';
import Logging from '../libraries/logging.library';
import crypto from 'crypto';

export interface CacheMiddlewareOptions {
    ttl?: number;
    prefix?: string;
    keyGenerator?: (req: Request) => string;
    condition?: (req: Request) => boolean;
    skipCache?: (req: Request) => boolean;
    varyBy?: string[]; // Headers to vary cache by
}

class CacheMiddleware {
    /**
     * Cache GET requests middleware
     */
    public static cache(options: CacheMiddlewareOptions = {}) {
        return async (req: Request, res: Response, next: NextFunction) => {
            // Only cache GET requests by default
            if (req.method !== 'GET') {
                return next();
            }

            // Check if we should skip caching
            if (options.skipCache && options.skipCache(req)) {
                return next();
            }

            // Check condition
            if (options.condition && !options.condition(req)) {
                return next();
            }

            try {
                const cacheKey = CacheMiddleware.generateCacheKey(req, options);
                const prefix = options.prefix || 'api';
                
                // Try to get from cache
                const cachedData = await CacheService.get(cacheKey, { prefix });
                
                if (cachedData) {
                    Logging.info(`Cache HIT for key: ${prefix}:${cacheKey}` );
                    
                    // Set cache headers
                    res.set({
                        'X-Cache': 'HIT',
                        'Cache-Control': 'no-store'
                    });
                    
                    return res.json(cachedData);
                }

                Logging.info(`Cache MISS for key: ${prefix}:${cacheKey}` );
                
                // Store original res.json to intercept response
                const originalJson = res.json.bind(res);
                
                res.json = function(data: any) {
                    // Cache the response
                    CacheService.set(cacheKey, data, {
                        ttl: options.ttl,
                        prefix
                    }).catch(error => {
                        Logging.error(`Failed to cache response: ${error}` );
                    });

                    // Set cache headers
                    res.set({
                        'X-Cache': 'MISS',
                        'Cache-Control': 'no-store'
                    });
                    
                    return originalJson(data);
                } as any;

                next();
            } catch (error) {
                Logging.error(`Cache middleware error: ${error}` );
                next();
            }
        };
    }

    /**
     * Invalidate cache middleware for write operations
     */
    public static invalidate(patterns: string[] | ((req: Request) => string[])) {
        return async (req: Request, res: Response, next: NextFunction) => {
            const originalJson = res.json.bind(res);
            
            res.json = async function(data: any) {
                try {
                    const invalidationPatterns = typeof patterns === 'function' 
                        ? patterns(req) 
                        : patterns;
                    
                    // Invalidate cache patterns
                    for (const pattern of invalidationPatterns) {
                        const cleared = await CacheService.clear(pattern);
                        Logging.info(`Invalidated ${cleared} cache entries for pattern: ${pattern}` );
                    }
                } catch (error) {
                    Logging.error(`Cache invalidation error: ${error}` );
                }
                
                return originalJson(data);
            } as any;

            next();
        };
    }

    /**
     * Generate cache key from request
     */
    private static generateCacheKey(req: Request, options: CacheMiddlewareOptions): string {
        if (options.keyGenerator) {
            return options.keyGenerator(req);
        }

        // Create key components
        const keyComponents = [
            req.method,
            req.originalUrl || req.url,
        ];

        // Add query parameters
        if (Object.keys(req.query).length > 0) {
            const sortedQuery = Object.keys(req.query)
                .sort()
                .reduce((result: any, key) => {
                    result[key] = req.query[key];
                    return result;
                }, {});
            keyComponents.push(JSON.stringify(sortedQuery));
        }

        // Add headers to vary by
        if (options.varyBy) {
            for (const header of options.varyBy) {
                const headerValue = req.get(header);
                if (headerValue) {
                    keyComponents.push(`${header}:${headerValue}` );
                }
            }
        }

        // Generate hash of key components
        const keyString = keyComponents.join('|');
        return crypto.createHash('md5').update(keyString).digest('hex');
    }

    /**
     * Cache warming middleware - preload cache with data
     */
    public static warm(dataLoader: (req: Request) => Promise<any>, options: CacheMiddlewareOptions = {}) {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const cacheKey = CacheMiddleware.generateCacheKey(req, options);
                const prefix = options.prefix || 'api';
                
                // Check if already cached
                const exists = await CacheService.exists(cacheKey, { prefix });
                
                if (!exists) {
                    const data = await dataLoader(req);
                    await CacheService.set(cacheKey, data, {
                        ttl: options.ttl,
                        prefix
                    });
                    Logging.info(`Cache WARMED for key: ${prefix}:${cacheKey}` );
                }
                
                next();
            } catch (error) {
                Logging.error(`Cache warming error: ${error}` );
                next();
            }
        };
    }

    /**
     * Rate limiting using Redis
     */
    public static rateLimit(options: {
        windowMs: number;
        maxRequests: number;
        keyGenerator?: (req: Request) => string;
        skipSuccessfulRequests?: boolean;
    }) {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const key = options.keyGenerator 
                    ? options.keyGenerator(req)
                    : `ratelimit:${req.ip}` ;
                
                const windowInSeconds = Math.ceil(options.windowMs / 1000);
                const current = await CacheService.incr(key, 1, { 
                    ttl: windowInSeconds,
                    prefix: 'rl'
                });
                
                if (current === null) {
                    return next();
                }

                const remaining = Math.max(0, options.maxRequests - current);
                
                // Set rate limit headers
                res.set({
                    'X-RateLimit-Limit': options.maxRequests.toString(),
                    'X-RateLimit-Remaining': remaining.toString(),
                    'X-RateLimit-Reset': new Date(Date.now() + options.windowMs).toISOString()
                });

                if (current > options.maxRequests) {
                    return res.status(429).json({
                        error: 'Too Many Requests',
                        message: `Rate limit exceeded. Try again in ${Math.ceil(options.windowMs / 1000)} seconds.` ,
                        retryAfter: Math.ceil(options.windowMs / 1000)
                    });
                }

                next();
            } catch (error) {
                Logging.error(`Rate limiting error: ${error}` );
                next();
            }
        };
    }
}

export default CacheMiddleware;
