import Redis, { Redis as RedisClient, RedisOptions } from 'ioredis';
import Logging from '../libraries/logging.library';
import { redisConfig } from '../config';

/**
 * RedisService - Singleton wrapper around ioredis with helpful utilities
 */
export class RedisService {
  private static instance: RedisService;
  private client?: RedisClient;
  private ready = false;

  private constructor() {}

  public static getInstance(): RedisService {
    if (!this.instance) {
      this.instance = new RedisService();
    }
    return this.instance;
  }

  public isReady(): boolean {
    return this.ready;
  }

  public getClient(): RedisClient {
    if (!this.client) throw new Error('Redis client not initialized');
    return this.client;
  }

  /**
   * Establish connection to Redis if not already connected
   */
  public async connect(): Promise<void> {
    if (this.client) return; // already connected or in progress

    const options: RedisOptions = {
      keyPrefix: redisConfig.keyPrefix,
      lazyConnect: true,
      enableAutoPipelining: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 100, 2000),
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET'];
        if (targetErrors.some((msg) => err.message.includes(msg))) {
          return true;
        }
        return false;
      },
    };

    let client: RedisClient;
    if (redisConfig.url) {
      client = new Redis(redisConfig.url, options);
    } else {
      client = new Redis({
        ...options,
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
      });
    }

    this.client = client;

    client.on('connect', () => Logging.info('Redis: connecting...'));
    client.on('ready', () => {
      this.ready = true;
      Logging.info('Redis: ready');
    });
    client.on('error', (err) => {
      this.ready = false;
      Logging.error('Redis error:', err);
    });
    client.on('end', () => {
      this.ready = false;
      Logging.info('Redis: connection ended');
    });

    await client.connect();
  }

  /**
   * Gracefully close the Redis connection
   */
  public async disconnect(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.quit();
    } catch (e) {
      Logging.error('Redis quit failed, forcing disconnect', e);
      try { await this.client.disconnect(); } catch {}
    } finally {
      this.client = undefined;
      this.ready = false;
    }
  }

  // Basic helpers
  public async set(key: string, value: string | number, ttlSeconds?: number): Promise<'OK' | null> {
    const client = this.getClient();
    if (ttlSeconds && ttlSeconds > 0) {
      return client.set(key, String(value), 'EX', ttlSeconds);
    }
    return client.set(key, String(value));
  }

  public async get(key: string): Promise<string | null> {
    return this.getClient().get(key);
  }

  public async del(key: string | string[]): Promise<number> {
    const client = this.getClient();
    if (Array.isArray(key)) {
      if (!key.length) return 0;
      return client.del(...key);
    }
    return client.del(key);
  }

  public async exists(key: string): Promise<boolean> {
    const count = await this.getClient().exists(key);
    return count === 1;
  }

  public async expire(key: string, ttlSeconds: number): Promise<number> {
    return this.getClient().expire(key, ttlSeconds);
  }

  // JSON helpers
  public async setJSON<T>(key: string, obj: T, ttlSeconds: number = redisConfig.defaultTTLSeconds): Promise<'OK' | null> {
    const payload = JSON.stringify(obj);
    return this.set(key, payload, ttlSeconds);
  }

  public async getJSON<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}

export default RedisService;
