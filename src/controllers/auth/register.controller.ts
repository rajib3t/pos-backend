import { Request, Response } from "express";
import { Controller } from "../controller";
import User, { IUser } from "../../models/user.model";
import UserService from "../../services/user.service";
import {    hashPassword} from "../../utils/passwords";
import Logging from "../../libraries/logging.library";
import { responseResult } from "../../utils/response";
import {errorResponse} from "../../utils/errorResponse"
class RegisterController extends Controller {
    private userService : UserService
    constructor() {
        super();
        this.router.post('/register', this.asyncHandler(this.register));
        this.userService = UserService.getInstance();
    }
    /**
     * Validate tenant context exists (but allow landlord requests)
     */
    private validateTenantContext(req: Request): void {
        if (!req.tenantConnection) {
            throw new Error('Database connection is required');
        }
    }

    /**
     * Get context info for logging
     */
    private getContextInfo(req: Request): string {
        if (req.isLandlord) {
            return 'landlord (main database)';
        }
        return `tenant ${req.tenant?.subdomain}`;
    }


    private register = async (req: Request, res: Response) => {
        this.validateTenantContext(req);

        const { email, password, name } = req.body;

        // Validate user input
        if (!email || !password) {
            return errorResponse.sendError({ res, statusCode: 400, message: "Email and password are required" });
        }

        try {
            // Check if user already exists (landlord or tenant)
            let existingUser: IUser | null;
            
            if (req.isLandlord) {
                existingUser = await this.userService.findByEmail(email);
            } else {
                existingUser = await this.userService.findByEmail(req.tenantConnection!, email);
            }

            if (existingUser) {
                return errorResponse.sendError({ res, statusCode: 409, message: "User already exists" });
            }

            const hashedPassword = await hashPassword(password);

            const userData = {
                email,
                password: hashedPassword,
                name
            };

            let user: IUser;

            if (req.isLandlord) {
                // Landlord request - use main database
                user = await this.userService.create(userData);
            } else {
                // Tenant request - use tenant database
                user = await this.userService.create(req.tenantConnection!, userData);
            }

            // Remove password from response
            const userResponse = { ...user.toObject(), password: undefined };

            Logging.info(`User registered in ${this.getContextInfo(req)}: ${email}`);
            
            return responseResult.sendResponse({ 
                res, 
                data: userResponse, 
                message: "Registration successful",
                statusCode: 201
            });
        } catch (error) {
            Logging.error(`Registration error in ${this.getContextInfo(req)}: ${error}`);
            errorResponse.sendError({ res, statusCode: 500, message: "Internal server error" });
        }
    }
}

export default new RegisterController().router;
