import jwt, { SignOptions, Algorithm } from 'jsonwebtoken';


import ms, { StringValue  }from 'ms';
import { jwtConfig } from '../config';

import TokenRepository from '../repositories/token.repository';
import { IToken } from '../models/token.model';
import { errorResponse } from '../utils/errorResponse';
import e, { Response } from 'express';
import Logging from '../libraries/logging.library';
import { log } from 'console';
import { Connection } from 'mongoose';

class TokenService {
    private static instance: TokenService;
    private secret: string;
    private refreshSecret: string;
    private accessTokenExpiresIn: string | number;
    private refreshTokenExpiresIn: string;
    private algorithm: Algorithm;

    private constructor() {
       
        this.secret = jwtConfig.accessSecret as string;
        this.refreshSecret = jwtConfig.refreshSecret as string;
        this.accessTokenExpiresIn = jwtConfig.accessTokenExpiresIn as StringValue;
        this.refreshTokenExpiresIn = jwtConfig.refreshTokenExpiresIn as StringValue;
        this.algorithm = jwtConfig.algorithm as Algorithm;
    }
    
    public static getInstance(): TokenService {
        if (!TokenService.instance) {
            TokenService.instance = new TokenService();
        }
        return TokenService.instance;
    }

    /**
     * Get appropriate token repository based on context
     * @param connection - Optional tenant connection (null for landlord)
     */
    private getTokenRepository(connection?: Connection | null): TokenRepository {
        if (connection) {
            // Tenant context - use tenant database
            return new TokenRepository(connection);
        } else {
            // Landlord context - use master database
            return new TokenRepository();
        }
    }
    
    /**
     * Generates a JWT token for a user.
     * @param {User} user - The user object for whom the token is generated.
     * @returns {string} - The generated JWT token.
     */
    public   generateToken = async (payload: any): Promise<string> => {
        if (!payload) {
            throw new Error('Payload is required to generate a token');
        }
        let token;
        const signOptions: SignOptions = {
            expiresIn: this.accessTokenExpiresIn as StringValue,
            algorithm: this.algorithm,
        };
        try {
            token = jwt.sign(payload, this.secret, signOptions);
        } catch (error) {
            throw new Error('Error generating token');
        }
        return token;
    }
            


    public generateRefreshToken = async (payload: any, connection?: Connection | null): Promise<{ token: string; expiresIn: string | number | Date }> => {
        if (!payload) {
            throw new Error('Payload is required to generate a token');
        }
        let token;

        const signOptions: SignOptions = {
            expiresIn: this.refreshTokenExpiresIn as StringValue,
            algorithm: this.algorithm,
        };

        try {
            token = jwt.sign(payload, this.refreshSecret, signOptions);
        } catch (error) {
            throw new Error('Error generating token');
        }
        const expiresAt = new Date(Date.now() + ms(this.refreshTokenExpiresIn as StringValue));
        const refreshTokenData = {
            user: payload.userId,
            type: 'refresh',
            token,
            isRevoked: false,
            expiresAt
        };

        // Use appropriate repository based on context
        const tokenRepository = this.getTokenRepository(connection);
        await tokenRepository.createToken(refreshTokenData as IToken);
        
        return {
            token,
            expiresIn: expiresAt
        };
    }

    public verifyToken = async (token: string): Promise<any> => {
        if (!token) {
            throw new Error('Token is required for verification');
        }
       
        try {
            const decoded = jwt.verify(token, this.secret);
            
            return decoded;
        } catch (error) {
            Logging.error(`Error verifying access token: ${error}`);
            return error;
        }
    }

    public verifyRefreshToken = async (token: string): Promise<any> => {
        if (!token) {
            throw new Error('Token is required for verification');
        }
        try {
            const decoded = jwt.verify(token, this.refreshSecret);
            return decoded;
        } catch (error) {
            Logging.error(`Error verifying refresh token: ${error}`);
            return error;
        }
    }   

    public refreshTheAccessToken = async (token: string, connection?: Connection | null): Promise<any> => {
        if (!token) {
            throw new Error('Token is required for refreshing');
        }
        
        // Use appropriate repository based on context
        const tokenRepository = this.getTokenRepository(connection);
        
        try {
            const refreshToken = await tokenRepository.findByToken(token);
        if (!refreshToken) {
            
            throw new Error('Invalid refresh token');
        }
        } catch (error) {
            console.log(error);

            throw new Error('Error refreshing token');
        }
        

        try {
            const decoded =  await this.verifyRefreshToken(token);
            
            // Preserve the original token payload structure for consistency
            const tokenPayload = {
                userId: decoded.userId,
                email: decoded.email,
                context: decoded.context,
                subdomain: decoded.subdomain,
                tenantId: decoded.tenantId,
                timestamp: new Date().getTime() // Update timestamp for new token
            };

            const newToken = await this.generateToken(tokenPayload);
            return { token: newToken, };
        } catch (error) {
            console.log(error);

            throw new Error('Invalid token');
        }
    }

    public invalidateRefreshToken = async (token: string, connection?: Connection | null): Promise<void> => {
       
        if (!token) {
            throw new Error('Token is required for invalidation');
        }
        
        // Use appropriate repository based on context
        const tokenRepository = this.getTokenRepository(connection);
        
        try {
            await tokenRepository.invalidateToken(token);
        } catch (error) {
            throw new Error('Error invalidating token');
        }
    }

}

export default TokenService;