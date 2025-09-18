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

