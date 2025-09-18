import Redis from 'ioredis';
import { redisConfig } from '../config';
import Logging from '../libraries/logging.library';

export interface CacheOptions {
    ttl?: number; // Time to live in seconds
    prefix?: string; // Additional prefix for the key
    compress?: boolean; // Whether to compress the data
}

export interface CacheStats {
    hits: number;
    misses: number;
    errors: number;
    totalRequests: number;
}

class CacheService {
    private static instance: CacheService;
    private redis!: Redis;
    private stats: CacheStats = {
        hits: 0,
        misses: 0,
        errors: 0,
        totalRequests: 0
    };
    
    private constructor() {
        this.initializeRedis();
    }

    public static getInstance(): CacheService {
        if (!CacheService.instance) {
            CacheService.instance = new CacheService();
        }
        return CacheService.instance;
    }

    private initializeRedis(): void {
        try {
            if (redisConfig.url) {
                // Use Redis URL if provided (e.g., redis://:password@host:6379/0)
                this.redis = new Redis(redisConfig.url, {
                    keyPrefix: redisConfig.keyPrefix,
                    maxRetriesPerRequest: 3,
                    lazyConnect: true,
                    enableOfflineQueue: true,
                    retryStrategy: (times) => Math.min(times * 100, 2000),
                });
            } else {
                // Use individual config options
                this.redis = new Redis({
                    host: redisConfig.host,
                    port: redisConfig.port,
                    password: redisConfig.password,
                    db: redisConfig.db,
                    keyPrefix: redisConfig.keyPrefix,
                    maxRetriesPerRequest: 3,
                    lazyConnect: true,
                    enableOfflineQueue: true,
                    retryStrategy: (times) => Math.min(times * 100, 2000),
                });
            }

            this.redis.on('connect', () => {
                Logging.info('Redis connected successfully');
            });

            this.redis.on('error', (error) => {
                Logging.error(`Redis connection error: ${error}` );
                this.stats.errors++;
            });

            this.redis.on('close', () => {
                Logging.info('Redis connection closed');
            });

        } catch (error) {
            Logging.error(`Failed to initialize Redis: ${error}` );
            throw error;
        }
    }

    /**
     * Get value from cache
     */
    public async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
        try {
            this.stats.totalRequests++;
            
            const fullKey = options?.prefix ? `${options.prefix}:${key}`  : key;
            const cachedValue = await this.redis.get(fullKey);
            
            if (cachedValue) {
                this.stats.hits++;
                
                if (options?.compress) {
                    // If compression was used, decompress here
                    // You can implement compression/decompression logic
                    return JSON.parse(cachedValue) as T;
                }
                
                return JSON.parse(cachedValue) as T;
            }
            
            this.stats.misses++;
            return null;
        } catch (error) {
            this.stats.errors++;
            Logging.error(`Cache GET error for key ${key}: ${error}` );
            return null;
        }
    }

    /**
     * Set value in cache
     */
    public async set(
        key: string, 
        value: any, 
        options?: CacheOptions
    ): Promise<boolean> {
        try {
            const fullKey = options?.prefix ? `${options.prefix}:${key}`  : key;
            const ttl = options?.ttl || redisConfig.defaultTTLSeconds;
            
            let serializedValue = JSON.stringify(value);
            
            if (options?.compress) {
                // Implement compression logic here if needed
                // serializedValue = compress(serializedValue);
            }
            
            const result = await this.redis.setex(fullKey, ttl, serializedValue);
            return result === 'OK';
        } catch (error) {
            this.stats.errors++;
            Logging.error(`Cache SET error for key ${key}: ${error}` );
            return false;
        }
    }

    /**
     * Delete value from cache
     */
    public async del(key: string, options?: { prefix?: string }): Promise<boolean> {
        try {
            const fullKey = options?.prefix ? `${options.prefix}:${key}`  : key;
            const result = await this.redis.del(fullKey);
            return result > 0;
        } catch (error) {
            this.stats.errors++;
            Logging.error(`Cache DELETE error for key ${key}: ${error}` );
            return false;
        }
    }

    /**
     * Check if key exists in cache
     */
    public async exists(key: string, options?: { prefix?: string }): Promise<boolean> {
        try {
            const fullKey = options?.prefix ? `${options.prefix}:${key}`  : key;
            const result = await this.redis.exists(fullKey);
            return result === 1;
        } catch (error) {
            this.stats.errors++;
            Logging.error(`Cache EXISTS error for key ${key}: ${error}` );
            return false;
        }
    }

    /**
     * Clear all cache with optional pattern
     */
    public async clear(pattern?: string): Promise<number> {
        try {
            const searchPattern = pattern ? `${redisConfig.keyPrefix}${pattern}`  : `${redisConfig.keyPrefix}*` ;
            const keys = await this.redis.keys(searchPattern);
            
            if (keys.length === 0) {
                return 0;
            }
            
            // Remove the key prefix for deletion since ioredis adds it automatically
            const keysWithoutPrefix = keys.map(key => 
                key.startsWith(redisConfig.keyPrefix) 
                    ? key.substring(redisConfig.keyPrefix.length)
                    : key
            );
            
            const result = await this.redis.del(...keysWithoutPrefix);
            Logging.info(`Cleared ${result} cache entries with pattern: ${searchPattern}` );
            return result;
        } catch (error) {
            this.stats.errors++;
            Logging.error(`Cache CLEAR error: ${error}` );
            return 0;
        }
    }

    /**
     * Set multiple key-value pairs
     */
    public async mset(keyValuePairs: Array<{key: string, value: any, ttl?: number}>, options?: CacheOptions): Promise<boolean> {
        try {
            const pipeline = this.redis.pipeline();
            
            keyValuePairs.forEach(({ key, value, ttl }) => {
                const fullKey = options?.prefix ? `${options.prefix}:${key}`  : key;
                const serializedValue = JSON.stringify(value);
                const expiry = ttl || options?.ttl || redisConfig.defaultTTLSeconds;
                
                pipeline.setex(fullKey, expiry, serializedValue);
            });
            
            const results = await pipeline.exec();
            return results?.every(result => result && result[1] === 'OK') || false;
        } catch (error) {
            this.stats.errors++;
            Logging.error(`Cache MSET error: ${error}` );
            return false;
        }
    }

    /**
     * Get multiple values
     */
    public async mget<T>(keys: string[], options?: CacheOptions): Promise<Array<T | null>> {
        try {
            this.stats.totalRequests += keys.length;
            
            const fullKeys = keys.map(key => 
                options?.prefix ? `${options.prefix}:${key}`  : key
            );
            
            const values = await this.redis.mget(...fullKeys);
            
            return values.map(value => {
                if (value) {
                    this.stats.hits++;
                    return JSON.parse(value) as T;
                } else {
                    this.stats.misses++;
                    return null;
                }
            });
        } catch (error) {
            this.stats.errors += keys.length;
            Logging.error(`Cache MGET error: ${error}` );
            return keys.map(() => null);
        }
    }

    /**
     * Increment a numeric value
     */
    public async incr(key: string, increment: number = 1, options?: CacheOptions): Promise<number | null> {
        try {
            const fullKey = options?.prefix ? `${options.prefix}:${key}`  : key;
            
            if (increment === 1) {
                const result = await this.redis.incr(fullKey);
                
                // Set TTL if this is a new key
                if (result === 1 && (options?.ttl || redisConfig.defaultTTLSeconds)) {
                    await this.redis.expire(fullKey, options?.ttl || redisConfig.defaultTTLSeconds);
                }
                
                return result;
            } else {
                const result = await this.redis.incrby(fullKey, increment);
                
                // Set TTL if this is a new key (or first increment)
                if (Math.abs(result) === Math.abs(increment) && (options?.ttl || redisConfig.defaultTTLSeconds)) {
                    await this.redis.expire(fullKey, options?.ttl || redisConfig.defaultTTLSeconds);
                }
                
                return result;
            }
        } catch (error) {
            this.stats.errors++;
            Logging.error(`Cache INCR error for key ${key}: ${error}` );
            return null;
        }
    }

    /**
     * Set expiration for a key
     */
    public async expire(key: string, ttl: number, options?: { prefix?: string }): Promise<boolean> {
        try {
            const fullKey = options?.prefix ? `${options.prefix}:${key}`  : key;
            const result = await this.redis.expire(fullKey, ttl);
            return result === 1;
        } catch (error) {
            this.stats.errors++;
            Logging.error(`Cache EXPIRE error for key ${key}: ${error}` );
            return false;
        }
    }

    /**
     * Get time to live for a key
     */
    public async ttl(key: string, options?: { prefix?: string }): Promise<number | null> {
        try {
            const fullKey = options?.prefix ? `${options.prefix}:${key}`  : key;
            const result = await this.redis.ttl(fullKey);
            return result;
        } catch (error) {
            this.stats.errors++;
            Logging.error(`Cache TTL error for key ${key}: ${error}` );
            return null;
        }
    }

    /**
     * Get cache statistics
     */
    public getStats(): CacheStats {
        const hitRate = this.stats.totalRequests > 0 
            ? (this.stats.hits / this.stats.totalRequests) * 100 
            : 0;
        
        return {
            ...this.stats,
            hitRate: parseFloat(hitRate.toFixed(2))
        } as CacheStats & { hitRate: number };
    }

    /**
     * Reset cache statistics
     */
    public resetStats(): void {
        this.stats = {
            hits: 0,
            misses: 0,
            errors: 0,
            totalRequests: 0
        };
    }

    /**
     * Health check for Redis connection
     */
    public async healthCheck(): Promise<{ status: string; message: string }> {
        try {
            const result = await this.redis.ping();
            if (result === 'PONG') {
                return { status: 'healthy', message: 'Redis connection is working' };
            } else {
                return { status: 'unhealthy', message: 'Redis ping returned unexpected response' };
            }
        } catch (error) {
            return { status: 'unhealthy', message: `Redis connection error: ${error}`  };
        }
    }

    /**
     * Close Redis connection
     */
    public async disconnect(): Promise<void> {
        try {
            await this.redis.quit();
            Logging.info('Redis connection closed gracefully');
        } catch (error) {
            Logging.error(`Error closing Redis connection: ${error}` );
        }
    }

    /**
     * Get Redis client for advanced operations
     */
    public getClient(): Redis {
        return this.redis;
    }
}

export default CacheService.getInstance();
