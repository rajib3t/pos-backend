import { Response } from 'express';
import { ZodError } from 'zod';
import Logging from '../libraries/logging.library';
import { errorResponse } from '../utils/errorResponse';
import {
    ValidationError,
    DatabaseError,
    NotFoundError,
    ConflictError,
    AuthenticationError,
    AuthorizationError,
    CacheError,
    ExternalServiceError,
    RateLimitError,
    BusinessLogicError,
    CreationFailedError,
    UpdateFailedError,
    isValidationError,
    isDatabaseError,
    isNotFoundError,
    isConflictError,
    isAuthenticationError,
    isAuthorizationError,
    isCacheError,
    isExternalServiceError,
    isRateLimitError,
    isBusinessLogicError,
    isCreationFailedError,
    isUpdateFailedError,
    convertMongoError,
    convertZodError
} from './CustomErrors';

export interface ErrorContext {
    operation?: string;
    resource?: string;
    userId?: string;
    tenantId?: string;
    requestId?: string;
    ip?: string;
    userAgent?: string;
}

export class ErrorHandler {
    /**
     * Enhanced error handling with specific error type detection and appropriate responses
     */
    public static handleError(error: any, res: Response, context?: ErrorContext): Response {
        // Log the error with context
        ErrorHandler.logError(error, context);

        // Handle Zod validation errors
        if (error instanceof ZodError) {
            const validationError = convertZodError(error);
            return ErrorHandler.sendValidationError(res, validationError);
        }

        // Handle custom validation errors
        if (isValidationError(error)) {
            return ErrorHandler.sendValidationError(res, error);
        }

        // Handle database errors (including MongoDB errors)
        if (isDatabaseError(error)) {
            return ErrorHandler.sendDatabaseError(res, error, context);
        }

        // Handle MongoDB errors that need conversion
        if (error.name === 'MongoError' || error.name === 'MongooseError' || error.code === 11000) {
            const convertedError = convertMongoError(error);
            return ErrorHandler.handleError(convertedError, res, context);
        }

        // Handle not found errors
        if (isNotFoundError(error)) {
            return ErrorHandler.sendNotFoundError(res, error);
        }

        // Handle conflict errors
        if (isConflictError(error)) {
            return ErrorHandler.sendConflictError(res, error);
        }

        // Handle authentication errors
        if (isAuthenticationError(error)) {
            return ErrorHandler.sendAuthenticationError(res, error);
        }

        // Handle authorization errors
        if (isAuthorizationError(error)) {
            return ErrorHandler.sendAuthorizationError(res, error);
        }

        // Handle cache errors
        if (isCacheError(error)) {
            return ErrorHandler.sendCacheError(res, error, context);
        }

        // Handle external service errors
        if (isExternalServiceError(error)) {
            return ErrorHandler.sendExternalServiceError(res, error);
        }

        // Handle rate limit errors
        if (isRateLimitError(error)) {
            return ErrorHandler.sendRateLimitError(res, error);
        }

        // Handle business logic errors
        if (isBusinessLogicError(error)) {
            return ErrorHandler.sendBusinessLogicError(res, error);
        }

        // Handle creation failed errors
        if (isCreationFailedError(error)) {
            return ErrorHandler.sendCreationFailedError(res, error);
        }

        // Handle update failed errors
        if (isUpdateFailedError(error)) {
            return ErrorHandler.sendUpdateFailedError(res, error);
        }

        // Handle unexpected errors
        return ErrorHandler.sendUnexpectedError(res, error, context);
    }

    private static sendValidationError(res: Response, error: ValidationError): Response {
        return errorResponse.sendError({
            res,
            message: error.message,
            statusCode: error.statusCode,
            details: error.details
        });
    }

    private static sendDatabaseError(res: Response, error: DatabaseError, context?: ErrorContext): Response {
        // Don't expose internal database details to client
        const clientMessage = 'Database operation failed';
        
        // Log detailed error for debugging
        Logging.error(`Database error in ${context?.operation || 'unknown operation'}:`, {
            error: error.message,
            operation: error.operation,
            collection: error.collection,
            context
        });

        return errorResponse.sendError({
            res,
            message: clientMessage,
            statusCode: error.statusCode,
            details: process.env.NODE_ENV === 'development' ? {
                operation: error.operation,
                collection: error.collection
            } : undefined
        });
    }

    private static sendNotFoundError(res: Response, error: NotFoundError): Response {
        return errorResponse.sendError({
            res,
            message: error.message,
            statusCode: error.statusCode,
            details: {
                resource: error.resource,
                resourceId: error.resourceId
            }
        });
    }

    private static sendConflictError(res: Response, error: ConflictError): Response {
        return errorResponse.sendError({
            res,
            message: error.message,
            statusCode: error.statusCode,
            details: error.conflictField ? [`${error.conflictField}: ${error.message}`] : undefined
        });
    }

    private static sendAuthenticationError(res: Response, error: AuthenticationError): Response {
        return errorResponse.sendError({
            res,
            message: error.message,
            statusCode: error.statusCode
        });
    }

    private static sendAuthorizationError(res: Response, error: AuthorizationError): Response {
        return errorResponse.sendError({
            res,
            message: error.message,
            statusCode: error.statusCode,
            details: error.requiredPermission ? {
                requiredPermission: error.requiredPermission
            } : undefined
        });
    }

    private static sendCacheError(res: Response, error: CacheError, context?: ErrorContext): Response {
        // Log cache errors for monitoring
        Logging.error(`Cache error in ${context?.operation || 'unknown operation'}:`, {
            error: error.message,
            operation: error.operation,
            context
        });

        return errorResponse.sendError({
            res,
            message: 'Cache operation failed',
            statusCode: error.statusCode
        });
    }

    private static sendExternalServiceError(res: Response, error: ExternalServiceError): Response {
        return errorResponse.sendError({
            res,
            message: `External service error: ${error.service || 'unknown service'}`,
            statusCode: error.statusCode,
            details: process.env.NODE_ENV === 'development' ? {
                service: error.service,
                originalError: error.originalError?.message
            } : undefined
        });
    }

    private static sendRateLimitError(res: Response, error: RateLimitError): Response {
        const response = errorResponse.sendError({
            res,
            message: error.message,
            statusCode: error.statusCode
        });

        // Add retry-after header if specified
        if (error.retryAfter) {
            res.setHeader('Retry-After', error.retryAfter);
        }

        return response;
    }

    private static sendBusinessLogicError(res: Response, error: BusinessLogicError): Response {
        return errorResponse.sendError({
            res,
            message: error.message,
            statusCode: error.statusCode,
            details: error.errorCode ? { errorCode: error.errorCode } : undefined
        });
    }

    private static sendCreationFailedError(res: Response, error: CreationFailedError): Response {
        return errorResponse.sendError({
            res,
            message: error.message,
            statusCode: error.statusCode,
            details: {
                resource: error.resource,
                reason: error.reason,
                failedFields: error.failedFields
            }
        });
    }

    private static sendUpdateFailedError(res: Response, error: UpdateFailedError): Response {
        return errorResponse.sendError({
            res,
            message: error.message,
            statusCode: error.statusCode,
            details: {
                resource: error.resource,
                resourceId: error.resourceId,
                reason: error.reason,
                failedFields: error.failedFields
            }
        });
    }

    private static sendUnexpectedError(res: Response, error: any, context?: ErrorContext): Response {
        // Log unexpected errors with full context
        Logging.error(`Unexpected error in ${context?.operation || 'unknown operation'}:`, {
            error: error.message || 'Unknown error',
            stack: error.stack,
            context,
            errorName: error.name,
            errorCode: error.code
        });

        return errorResponse.sendError({
            res,
            message: 'Internal Server Error',
            statusCode: 500,
            details: process.env.NODE_ENV === 'development' ? {
                error: error.message,
                name: error.name,
                code: error.code
            } : undefined
        });
    }

    private static logError(error: any, context?: ErrorContext): void {
        const logData = {
            error: error.message || 'Unknown error',
            errorName: error.name,
            errorCode: error.code,
            statusCode: error.statusCode,
            context,
            timestamp: new Date().toISOString()
        };

        // Log with appropriate level based on error type
        if (isValidationError(error) || isNotFoundError(error) || isConflictError(error) || 
            isCreationFailedError(error) || isUpdateFailedError(error)) {
            Logging.warn('Client error:', logData);
        } else if (isDatabaseError(error) || isCacheError(error) || isExternalServiceError(error)) {
            Logging.error('System error:', logData);
        } else {
            Logging.error('Unexpected error:', logData);
        }
    }

    /**
     * Create error context from request and additional data
     */
    public static createContext(req: any, additionalContext?: Partial<ErrorContext>): ErrorContext {
        return {
            operation: additionalContext?.operation,
            resource: additionalContext?.resource,
            userId: req.userId || additionalContext?.userId,
            tenantId: req.tenantId || additionalContext?.tenantId,
            requestId: req.id || req.requestId,
            ip: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('User-Agent'),
            ...additionalContext
        };
    }

    /**
     * Async wrapper for controller methods with enhanced error handling
     */
    public static asyncHandler(operation: string, resource?: string) {
        return (fn: Function) => {
            return async (req: any, res: Response, next: Function) => {
                try {
                    await fn(req, res, next);
                } catch (error) {
                    const context = ErrorHandler.createContext(req, { operation, resource });
                    ErrorHandler.handleError(error, res, context);
                }
            };
        };
    }
}

export default ErrorHandler;
