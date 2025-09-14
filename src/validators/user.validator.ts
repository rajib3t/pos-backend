import { z } from "zod";
import UserService from "../services/user.service";
const profileUpdateSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Name is required").max(100, "Name is too long").optional(),
        email: z.string().trim().pipe(z.email()).optional(),
        mobile: z.string().min(10, "Mobile number must be at least 10 digits").max(10, "Mobile number must be exactly 10 digits").optional(),
        address: z.string().max(200, "Address is too long").optional(),
        city: z.string().max(100, "City is too long").optional(),
        country: z.string().max(100, "Country is too long").optional(),
        postalCode: z.string().min(6, "Postal code must be at least 6 characters").max(6, "Postal code is too long").optional(),
    }),
   

});

// Helper function to validate email uniqueness (to be used in controller after schema validation)
const validateEmailUniqueness = async (
    email: string, 
    tenantConnection?: any, 
    isLandlord?: boolean
): Promise<{ isValid: boolean; message?: string }> => {
    const userService = UserService.getInstance();
    let existingUser;

    try {
        if (isLandlord) {
            // Landlord request - check main database
            existingUser = await userService.findByEmail(email);
        } else if (tenantConnection) {
            // Tenant request - check tenant database
            existingUser = await userService.findByEmail(tenantConnection, email);
        } else {
            // No proper context - should not happen
            return { isValid: false, message: "Invalid request context" };
        }

        if (existingUser) {
            return { 
                isValid: false, 
                message: isLandlord ? "Email is already used" : "Email is already in use"
            };
        }

        return { isValid: true };
    } catch (error) {
        console.error('Email uniqueness validation error:', error);
        return { isValid: false, message: "Failed to validate email uniqueness" };
    }
}


const validateMobileUniqueness = async (
    mobile: string, 
    tenantConnection?: any, 
    isLandlord?: boolean
): Promise<{ isValid: boolean; message?: string }> => {
    const userService = UserService.getInstance();
    let existingUser;

    try {
        if (isLandlord) {
            // Landlord request - check main database
            existingUser = await userService.findByMobile(mobile);
        } else if (tenantConnection) {
            // Tenant request - check tenant database
            existingUser = await userService.findByMobile(tenantConnection, mobile);
        } else {
            // No proper context - should not happen
            return { isValid: false, message: "Invalid request context" };
        }

        if (existingUser) {
            return { 
                isValid: false, 
                message: isLandlord ? "Mobile number is already used" : "Mobile number is already in use"
            };
        }

        return { isValid: true };
    } catch (error) {
        console.error('Email uniqueness validation error:', error);
        return { isValid: false, message: "Failed to validate email uniqueness" };
    }
}

export { profileUpdateSchema, validateEmailUniqueness};