/**
 * Custom Error Classes for Enhanced Error Handling
 * Provides specific error types for better error categorization and handling
 */

export class ValidationError extends Error {
    public readonly statusCode: number = 400;
    public readonly details: string[];

    constructor(message: string, details: string[] = []) {
        super(message);
        this.name = 'ValidationError';
        this.details = details;
        
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ValidationError);
        }
    }
}

export class DatabaseError extends Error {
    public readonly statusCode: number = 500;
    public readonly operation?: string;
    public readonly collection?: string;

    constructor(message: string, operation?: string, collection?: string) {
        super(message);
        this.name = 'DatabaseError';
        this.operation = operation;
        this.collection = collection;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DatabaseError);
        }
    }
}

export class NotFoundError extends Error {
    public readonly statusCode: number = 404;
    public readonly resource?: string;
    public readonly resourceId?: string;

    constructor(message: string, resource?: string, resourceId?: string) {
        super(message);
        this.name = 'NotFoundError';
        this.resource = resource;
        this.resourceId = resourceId;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, NotFoundError);
        }
    }
}

export class ConflictError extends Error {
    public readonly statusCode: number = 409;
    public readonly conflictField?: string;
    public readonly conflictValue?: string;

    constructor(message: string, conflictField?: string, conflictValue?: string) {
        super(message);
        this.name = 'ConflictError';
        this.conflictField = conflictField;
        this.conflictValue = conflictValue;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ConflictError);
        }
    }
}

export class AuthenticationError extends Error {
    public readonly statusCode: number = 401;

    constructor(message: string = 'Authentication failed') {
        super(message);
        this.name = 'AuthenticationError';
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AuthenticationError);
        }
    }
}

export class AuthorizationError extends Error {
    public readonly statusCode: number = 403;
    public readonly requiredPermission?: string;

    constructor(message: string = 'Access denied', requiredPermission?: string) {
        super(message);
        this.name = 'AuthorizationError';
        this.requiredPermission = requiredPermission;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, AuthorizationError);
        }
    }
}

export class CacheError extends Error {
    public readonly statusCode: number = 500;
    public readonly operation?: string;

    constructor(message: string, operation?: string) {
        super(message);
        this.name = 'CacheError';
        this.operation = operation;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CacheError);
        }
    }
}

export class ExternalServiceError extends Error {
    public readonly statusCode: number = 502;
    public readonly service?: string;
    public readonly originalError?: Error;

    constructor(message: string, service?: string, originalError?: Error) {
        super(message);
        this.name = 'ExternalServiceError';
        this.service = service;
        this.originalError = originalError;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ExternalServiceError);
        }
    }
}

export class RateLimitError extends Error {
    public readonly statusCode: number = 429;
    public readonly retryAfter?: number;

    constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
        super(message);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, RateLimitError);
        }
    }
}

export class BusinessLogicError extends Error {
    public readonly statusCode: number = 422;
    public readonly errorCode?: string;

    constructor(message: string, errorCode?: string) {
        super(message);
        this.name = 'BusinessLogicError';
        this.errorCode = errorCode;
        
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, BusinessLogicError);
        }
    }
}

// Type guard functions for error checking
export const isValidationError = (error: any): error is ValidationError => {
    return error instanceof ValidationError || error.name === 'ValidationError';
};

export const isDatabaseError = (error: any): error is DatabaseError => {
    return error instanceof DatabaseError || error.name === 'DatabaseError' || 
           error.name === 'MongoError' || error.name === 'MongooseError' ||
           error.code === 11000 || error.code === 11001; // MongoDB duplicate key errors
};

export const isNotFoundError = (error: any): error is NotFoundError => {
    return error instanceof NotFoundError || error.name === 'NotFoundError';
};

export const isConflictError = (error: any): error is ConflictError => {
    return error instanceof ConflictError || error.name === 'ConflictError';
};

export const isAuthenticationError = (error: any): error is AuthenticationError => {
    return error instanceof AuthenticationError || error.name === 'AuthenticationError';
};

export const isAuthorizationError = (error: any): error is AuthorizationError => {
    return error instanceof AuthorizationError || error.name === 'AuthorizationError';
};

export const isCacheError = (error: any): error is CacheError => {
    return error instanceof CacheError || error.name === 'CacheError';
};

export const isExternalServiceError = (error: any): error is ExternalServiceError => {
    return error instanceof ExternalServiceError || error.name === 'ExternalServiceError';
};

export const isRateLimitError = (error: any): error is RateLimitError => {
    return error instanceof RateLimitError || error.name === 'RateLimitError';
};

export const isBusinessLogicError = (error: any): error is BusinessLogicError => {
    return error instanceof BusinessLogicError || error.name === 'BusinessLogicError';
};

// Utility function to convert MongoDB errors to custom errors
export const convertMongoError = (error: any): Error => {
    if (error.code === 11000 || error.code === 11001) {
        // Duplicate key error
        const field = Object.keys(error.keyPattern || {})[0] || 'field';
        const value = Object.values(error.keyValue || {})[0] || 'value';
        return new ConflictError(
            `Duplicate value for ${field}`,
            field,
            String(value)
        );
    }
    
    if (error.name === 'ValidationError') {
        const details = Object.values(error.errors || {}).map((err: any) => 
            `${err.path}: ${err.message}`
        );
        return new ValidationError('Validation failed', details);
    }
    
    if (error.name === 'CastError') {
        return new ValidationError(`Invalid ${error.path}: ${error.value}`);
    }
    
    return new DatabaseError(error.message || 'Database operation failed');
};

// Utility function to convert Zod errors to ValidationError
export const convertZodError = (error: any): ValidationError => {
    const issues = error.issues || error.errors || [];
    const formattedErrors = issues.map((issue: any) => {
        const field = issue.path.slice(1).join('.'); // Remove 'body', 'query', or 'params' from path
        return `${field}: ${issue.message}`;
    });
    
    return new ValidationError('Validation failed', formattedErrors);
};
