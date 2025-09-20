import { z } from "zod";
import UserService from "../services/user.service";
import Logging from "../libraries/logging.library";

// Basic user creation schema for user controller
const createUserSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Name is required").max(100, "Name is too long"),
        email: z.string().trim().pipe(z.email("Invalid email format")),
        mobile: z.string().min(10, "Mobile number must be at least 10 digits").max(15, "Mobile number is too long").optional(),
        password: z.string().min(6, "Password must be at least 6 characters").max(100, "Password is too long"),
    })
});

// User update schema
const updateUserSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Name is required").max(100, "Name is too long").optional(),
        email: z.string().trim().pipe(z.email("Invalid email format")).optional(),
        mobile: z.string().min(10, "Mobile number must be at least 10 digits").max(15, "Mobile number is too long").optional(),
    }),
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid user ID format"),
    })
});

// Get user by ID schema
const getUserSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid user ID format"),
    })
});

// Delete user schema
const deleteUserSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid user ID format"),
    })
});

// Profile update schema for profile controller
const profileUpdateSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Name is required").max(100, "Name is too long").optional(),
        email: z.string().trim().pipe(z.email()).optional(),
        mobile: z.string().min(10, "Mobile number must be at least 10 digits").max(10, "Mobile number must be exactly 10 digits").optional(),
        address: z.string().max(200, "Address is too long").optional(),
        city: z.string().max(100, "City is too long").optional(),
        country: z.string().max(100, "Country is too long").optional(),
        postalCode: z.string().min(6, "Postal code must be at least 6 characters").max(6, "Postal code is too long").optional(),
    })
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
        Logging.error('Email uniqueness validation error:', error);
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
        Logging.error('Mobile uniqueness validation error:', error);
        return { isValid: false, message: "Failed to validate mobile uniqueness" };
    }
}


const createUserForTenantSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Name is required").max(100, "Name is too long"),
        email: z.string().trim().pipe(z.email()),
        mobile: z.string().min(10, "Mobile number must be at least 10 digits").max(10, "Mobile number must be exactly 10 digits"),
        password: z.string().min(6, "Password must be at least 8 characters").max(100, "Password is too long"),
        role: z.enum(['admin', 'user', 'manager'])

    }),
    params: z.object({
        tenantId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid tenant ID format"),
    })
});

const getUsersForTenantSchema = z.object({
    params: z.object({
        tenantId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid tenant ID format"),
    }),
    query: z.object({
        page: z.string().regex(/^\d+$/, "Page must be numeric").optional(),
        limit: z.string().regex(/^\d+$/, "Limit must be numeric").optional(),
        name: z.string().optional(),
        email: z.string().optional(),
        mobile: z.string().optional(),
        role: z.enum(['admin', 'user', 'manager']).optional(),
        createdAtFrom: z.string().optional(),
        createdAtTo: z.string().optional(),
        sortField: z.string().optional(),
        sortDirection: z.enum(["asc", "desc"]).optional(),
    })
});

const getUserForTenantSchema = z.object({
    params: z.object({
        tenantId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid tenant ID format"),
        userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid user ID format"),
    })
});

const updateUserForTenantSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Name is required").max(100, "Name is too long").optional(),
        email: z.string().trim().pipe(z.email()).optional(),
        mobile: z.string().min(10, "Mobile number must be at least 10 digits").max(10, "Mobile number must be exactly 10 digits").optional(),
        address: z.string().max(200, "Address is too long").optional(),
        city: z.string().max(100, "City is too long").optional(),
        country: z.string().max(100, "Country is too long").optional(),
        postalCode: z.string().min(6, "Postal code must be at least 6 characters").max(6, "Postal code is too long").optional(),

    }),
    params: z.object({
        tenantId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid tenant ID format"),
        userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid user ID format"),
    })
});

const deleteUserForTenantSchema = z.object({
    params: z.object({
        tenantId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid tenant ID format"),
        userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid user ID format"),
    })
});

const changeUserPasswordForTenantSchema = z.object({
    body: z.object({
        
        newPassword: z.string().min(6, "New password must be at least 6 characters").max(100, "New password is too long"),
    }),
    params: z.object({
        tenantId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid tenant ID format"),
        userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid user ID format"),
    })
});

export { 
    createUserSchema,
    updateUserSchema,
    getUserSchema,
    deleteUserSchema,
    profileUpdateSchema, 
    validateEmailUniqueness, 
    validateMobileUniqueness, 
    createUserForTenantSchema,
    getUsersForTenantSchema,
    getUserForTenantSchema,
    updateUserForTenantSchema,
    deleteUserForTenantSchema,
    changeUserPasswordForTenantSchema
};