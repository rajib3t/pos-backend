import { z } from "zod";


// Basic store creation schema
const createStoreSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
        code: z.string().trim().min(1, "Code is required").max(20, "Code is too long"),
        description: z.string().max(500, "Description is too long").optional(),
        address: z.string().max(200, "Address is too long").optional(),
        phone: z.string().max(20, "Phone number is too long").optional(),
        email: z.string().email("Invalid email format").optional(),
        isActive: z.boolean().default(true)
    })
});

// Store update schema
const updateStoreSchema = z.object({
    body: z.object({
        name: z.string().trim().min(1, "Name is required").max(100, "Name is too long").optional(),
        code: z.string().trim().min(1, "Code is required").max(20, "Code is too long").optional(),
        description: z.string().max(500, "Description is too long").optional(),
        address: z.string().max(200, "Address is too long").optional(),
        phone: z.string().max(20, "Phone number is too long").optional(),
        email: z.string().email("Invalid email format").optional(),
        isActive: z.boolean().optional()
    }),
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid store ID format"),
    })
});

// Get store by ID schema
const getStoreSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid store ID format"),
    })
});

// Delete store schema
const deleteStoreSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid store ID format"),
    })
});

// Store query parameters schema
const storeQuerySchema = z.object({
    query: z.object({
        page: z.string().regex(/^\d+$/, "Page must be numeric").optional(),
        limit: z.string().regex(/^\d+$/, "Limit must be numeric").optional(),
        name: z.string().optional(),
        code: z.string().optional(),
        createdAtFrom: z.string().optional(),
        createdAtTo: z.string().optional(),
        sortField: z.string().optional(),
        sortDirection: z.enum(["asc", "desc"]).optional(),
    })
});


export {
    storeQuerySchema,
    createStoreSchema,
    updateStoreSchema,
    getStoreSchema,
    deleteStoreSchema
}
