import { z } from "zod";


// Basic store creation schema
const createStoreSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
        code: z.string().trim().min(1, "Code is required").max(20, "Code is too long"),
        mobile: z.string().max(20, "Phone number is too long").optional(),
        email:  z.string().trim().pipe(z.email()).optional(),
        
    })
});

// Store update schema
const updateStoreSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
        code: z.string().trim().min(1, "Code is required").max(20, "Code is too long"),
        mobile: z.string().max(20, "Phone number is too long").optional(),
        email:  z.string().trim().pipe(z.email()).optional(),
    }),
    params: z.object({
        storeID: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid store ID format"),
    })
});

// Get store by ID schema
const getStoreSchema = z.object({
    params: z.object({
        storeID: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid store ID format"),
    })
});

// Delete store schema
const deleteStoreSchema = z.object({
    params: z.object({
        storeID: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid store ID format"),
    })
});

// Store query parameters schema
const storeQuerySchema = z.object({
    query: z.object({
        page: z.string().regex(/^\d+$/, "Page must be numeric").optional(),
        limit: z.string().regex(/^\d+$/, "Limit must be numeric").optional(),
        name: z.string().optional(),
        code: z.string().optional(),
        email:z.string().optional(),
        mobile:z.string().optional(),
        createdAtFrom: z.string().optional(),
        createdAtTo: z.string().optional(),
        sortField: z.string().optional(),
        sortDirection: z.enum(["asc", "desc"]).optional(),
    })
});



const storeStaffQuerySchema = z.object({
    query: z.object({
        page: z.string().regex(/^\d+$/, "Page must be numeric").optional(),
        limit: z.string().regex(/^\d+$/, "Limit must be numeric").optional(),
        role: z.string().optional(),
        status: z.string().optional(),
        userName: z.string().optional(),
        sortField: z.string().optional(),
        sortDirection: z.enum(["asc", "desc"]).optional(),
    }),
    params: z.object({
        storeID: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid store ID format"),
    })
});

// List eligible users to add as staff (exclude owners and users already assigned to the store)
const storeStaffCandidateQuerySchema = z.object({
    query: z.object({
        page: z.string().regex(/^\d+$/, "Page must be numeric").optional(),
        limit: z.string().regex(/^\d+$/, "Limit must be numeric").optional(),
        search: z.string().optional(),
        sortField: z.string().optional(),
        sortDirection: z.enum(["asc", "desc"]).optional(),
    }),
    params: z.object({
        storeID: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid store ID format"),
    })
});

// Create store staff (membership) schema
const storeStaffCreateSchema = z.object({
    params: z.object({
        storeID: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid store ID format"),
    }),
    body: z.object({
        userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid user ID format"),
        role: z.enum(["staff", "admin", "manager", "viewer"]).optional(),
        status: z.enum(["active", "inactive", "pending"]).optional(),
        permissions: z.array(z.string().min(1)).optional()
    })
});

export {
    storeQuerySchema,
    createStoreSchema,
    updateStoreSchema,
    getStoreSchema,
    deleteStoreSchema,
    storeStaffQuerySchema,
    storeStaffCreateSchema,
    storeStaffCandidateQuerySchema
}
