import { NextFunction, Request, Response } from "express";

import { Controller } from "./controller";
import Logging from "../libraries/logging.library";
import UserService from "../services/user.service";
import { responseResult } from "../utils/response";
import { errorResponse } from "../utils/errorResponse";
import { IAddress } from "../models/address.model";
import AddressRepository from "../repositories/address.repository";
import { IUser } from "../models/user.model";
import { comparePassword, hashPassword } from "../utils/passwords";
import { profileUpdateSchema, validateEmailUniqueness } from "../validators/user.validator";
import ValidateMiddleware from "../middlewares/validate";

class ProfileController extends Controller {
     private userService: UserService;

     constructor() {
        super();
        this.initializeRoutes();
        this.userService = UserService.getInstance();
    }

    private initializeRoutes() {
        this.router.get("/", this.asyncHandler(this.index));
        this.router.patch("/", ValidateMiddleware.getInstance().validate(profileUpdateSchema), this.asyncHandler(this.updateProfile));
        this.router.patch("/password", this.asyncHandler(this.updatePassword));
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

        /**
         * Get appropriate address repository based on context
         */
        private getAddressRepository(req: Request): AddressRepository {
            if (req.isLandlord) {
                // Landlord context - use master database
                return new AddressRepository();
            } else {
                // Tenant context - use tenant database
                return new AddressRepository(req.tenantConnection!);
            }
        }

    private index = async (req: Request, res: Response) => {
        this.validateTenantContext(req);
        
        const userId = req.userId; // Access the userId from the request object
       
        try{
            let userProfile;
            const addressRepository = this.getAddressRepository(req);

            if (req.isLandlord) {
                // Landlord request - use main database
                userProfile = await this.userService.getUserProfile(userId as string);
            } else {
                // Tenant request - use tenant database
                userProfile = await this.userService.getUserProfile(req.tenantConnection!, userId as string);
            }
            
            if (!userProfile) {
                return errorResponse.sendError({
                    res,
                    statusCode: 404,
                    message: "User profile not found",
                });
            }

            const userAddress = await addressRepository.findByUserId(userId as string);

            const userProfileData = {
                id: userProfile.id,
                email: userProfile.email,
                name: userProfile.name,
                mobile: userProfile.mobile,
                address: userAddress ? {
                    street: userAddress.street,
                    city: userAddress.city,
                    state: userAddress.state,
                    zip: userAddress.zip
                } : null
            }

            Logging.info(`Profile fetched for ${this.getContextInfo(req)}: ${userProfile.email}`);
            responseResult.sendResponse({ 
                res,
                data: userProfileData, // Changed from userProfile to userProfileData
                message: "User profile fetched successfully",
                
                });
        }catch(error){
            Logging.error(`Error fetching profile for ${this.getContextInfo(req)}: ${error}`)
            errorResponse.sendError({
                res,
                message: "Error fetching user profile",
            });
        }
        
    };

    private updateProfile = async (req: Request, res: Response, next: NextFunction) => {
        this.validateTenantContext(req);
        
        const userId = req.userId; // Access the userId from the request object
        const { name, email, mobile } = req.body;
        const { address, city, state, postalCode } = req.body;

        try {
            let user;
            const addressRepository = this.getAddressRepository(req);

            if (req.isLandlord) {
                // Landlord request - use main database
                user = await this.userService.findById(userId as string);
            } else {
                // Tenant request - use tenant database
                user = await this.userService.findById(req.tenantConnection!, userId as string);
            }

            if (!user) {
                return errorResponse.sendError({
                    res,
                    message: "User not found",
                });
            }

            if (email && email !== user.email) {
                let existingUser;
                 // Use the new email uniqueness validation
                const emailValidation = await validateEmailUniqueness(email, req.tenantConnection, req.isLandlord);
                
                if (!emailValidation.isValid) {
                    return errorResponse.sendError({ 
                        res, 
                        statusCode: 409, 
                        message: "Validation failed",
                        details: [`email: ${emailValidation.message}`]
                    });
                }
            }

            if(mobile && mobile !== user.mobile){
                let existingUser;
                if (req.isLandlord) {
                    existingUser = await this.userService.findByMobile(mobile);
                } else {
                    existingUser = await this.userService.findByMobile(req.tenantConnection!, mobile);
                }

                if (existingUser) {
                    return errorResponse.sendError({
                        res,
                        statusCode: 409,
                        message: "Validation failed",
                        details: ["mobile: Mobile number is already in use"],
                    });
                }
            }


            let updatedUser;
            if (req.isLandlord) {
                updatedUser = await this.userService.update(userId as string, {
                    name,
                    email,
                    mobile,
                });
            } else {
                updatedUser = await this.userService.update(req.tenantConnection!, userId as string, {
                    name,
                    email,
                    mobile,
                });
            }
            
            const userAddress = await addressRepository.findByUserId(userId as string);
            if (userAddress) {
                // Update existing address
                await addressRepository.update(userAddress?._id as string, {
                    street: address,
                    city,
                    state,
                    zip: postalCode,
                });
            } else {
                // Create new address
                const newAddress: Partial<IAddress> = {
                    userId: user as IUser,
                    street: address,
                    city,
                    state,
                    zip: postalCode,
                };
                await addressRepository.create(newAddress);
            }

            const updatedAddress = await addressRepository.findByUserId(userId as string);

            responseResult.sendResponse({
                res,
                data: {
                  
                    email: updatedUser?.email,
                    name: updatedUser?.name,
                    mobile: updatedUser?.mobile,
                    address: { street: updatedAddress?.street, city: updatedAddress?.city, state: updatedAddress?.state, zip: updatedAddress?.zip }
                },
                message: "User profile updated successfully",
            });
        }catch (error) {
            Logging.error(`Error updating profile for ${this.getContextInfo(req)}: ${error}`)
            errorResponse.sendError({
                res,
                message: "Error updating user profile",
            });
        }
            
    }

    private updatePassword = async (req: Request, res: Response, next : NextFunction) => {
        this.validateTenantContext(req);
        
        const userId = req.userId; // Access the userId from the request object
        const { currentPassword, newPassword } = req.body;

        try {
            let user;

            if (req.isLandlord) {
                // Landlord request - use main database
                user = await this.userService.findById(userId as string);
            } else {
                // Tenant request - use tenant database
                user = await this.userService.findById(req.tenantConnection!, userId as string);
            }

            if (!user || !user.password) {
                return errorResponse.sendError({
                    res,
                    message: "User not found",
                });
            }

            const isPasswordValid = await comparePassword(currentPassword, user.password);
            if (!isPasswordValid) {
                return errorResponse.sendError({
                    res,
                    statusCode: 406,
                    message: "Current password is incorrect",
                });
            }

            const hashedNewPassword = await hashPassword(newPassword);
            
            if (req.isLandlord) {
                await this.userService.update(userId as string, { password: hashedNewPassword });
            } else {
                await this.userService.update(req.tenantConnection!, userId as string, { password: hashedNewPassword });
            }

            Logging.info(`Password updated for ${this.getContextInfo(req)}: ${user.email}`);
            responseResult.sendResponse({
                res,
                data: null,
                statusCode: 200,
                message: "Password updated successfully",
            });
        } catch (error) {
            Logging.error(`Error updating password for ${this.getContextInfo(req)}: ${error}`)
            errorResponse.sendError({
                res,
                message: "Error updating password",
            });
        }
    }
}

export default new ProfileController().router;