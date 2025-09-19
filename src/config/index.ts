import { config } from 'dotenv';

// Load environment variables from the specified .env file
const envFile = `.env`;
config({ path: envFile });


export const appConfig = {
    port: parseInt(process.env.PORT as string) || 3000,
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [],

};


export const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT as string) || 27017,
    name: process.env.DB_NAME || 'mydatabase',
    username: process.env.DB_USERNAME || 'admin',
    password: process.env.DB_PASSWORD || 'secret',
};


export const jwtConfig = {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'superlongrandomaccesssecret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'superlongrandomrefreshsecret',
    accessTokenExpiresIn: process.env.ACCESS_TTL || '15m',
    refreshTokenExpiresIn: process.env.REFRESH_TTL || '7d',
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
};


export const cookieConfig = {
    baseDomain: process.env.BASE_DOMAIN || 'mypos.local',
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
};

// Mail configuration for SMTP
export const mailConfig = {
    host: process.env.SMTP_HOST || 'localhost',
    port: Number(process.env.SMTP_PORT || 1025),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'no-reply@mypos.local'
};

// Redis configuration for caching
export const redisConfig = {
    // Prefer single URL if provided (e.g. redis://:password@host:6379/0)
    url: process.env.REDIS_URL || '',
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB || 0),
    keyPrefix: process.env.REDIS_PREFIX || 'pos:',
    defaultTTLSeconds: Number(process.env.CACHE_TTL || 300), // 5 minutes default
};

// Notification / administrative email recipients
export const notificationConfig = {
    adminEmail: process.env.ADMIN_EMAIL || 'admin@platform.com',
    securityEmail: process.env.SECURITY_EMAIL || 'security@platform.com',
    businessEmail: process.env.BUSINESS_EMAIL || 'business@platform.com'
};


// Rate limiting configuration
export const rateLimitConfig = {
    get: Number(process.env.RATE_LIMIT_GET || 100), // Default 100 requests per window
    post: Number(process.env.RATE_LIMIT_POST || 100), // Default 100 requests per window
    put: Number(process.env.RATE_LIMIT_PUT || 50), // Default 50 requests per window
    delete: Number(process.env.RATE_LIMIT_DELETE || 20), // Default 20 requests per window
    patch: Number(process.env.RATE_LIMIT_PATCH || 100) // Default 100 requests per window
};

