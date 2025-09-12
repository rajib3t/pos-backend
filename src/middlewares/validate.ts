import { ZodSchema } from "zod";
import { Request, Response, NextFunction } from "express";
import { errorResponse } from "../utils/errorResponse";
import Logging from "../libraries/logging.library";


class ValidateMiddleware {
     private static instance: ValidateMiddleware;

    public static getInstance(): ValidateMiddleware {
        if (!ValidateMiddleware.instance) {
            ValidateMiddleware.instance = new ValidateMiddleware();
        }
        return ValidateMiddleware.instance;
    }



    public validate(schema: ZodSchema<any>) {
        return (req: Request, res: Response, next: NextFunction) => {
            try {
                // merge body, query, and params into one object if needed
                schema.parse({
                    body: req.body,
                    query: req.query,
                    params: req.params,
                    
                });
                next();
            } catch (err: any) {
                
                
                // Format Zod errors into user-friendly messages
                // ZodError has an 'issues' property containing the error array
                const issues = err.issues || err.errors || [];
                const formattedErrors = issues.map((error: any) => {
                    const field = error.path.slice(1).join('.'); // Remove 'body', 'query', or 'params' from path
                    return `${field}: ${error.message}`;
                });
                
                return errorResponse.sendError({ 
                    res, 
                    statusCode: 400, 
                    message: "Validation failed",
                    details: formattedErrors
                });
            }
        };
    }

}

export default ValidateMiddleware;