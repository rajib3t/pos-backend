import z from "zod";

const tenantSettingSchema = z.object({
    body: z.object({
        address1: z.string().min(1, "Address 1 is required").optional(),
        address2: z.string().optional(),
        cgst: z.number().min(1, "CGST is required").optional(),
        city: z.string().min(1, "City is required").optional(),
        code: z.string().min(1, "Code is required").uppercase().optional(),
        country: z.string().min(1, "Country is required").optional(),
        currency: z.string().min(1, "Currency is required").optional(),
        email: z.string().trim().pipe(z.email()).optional(),
        fassi: z.string().optional(),
        gstNumber: z.string().min(1, "GST Number is required").optional(),
        phone: z.string().min(1, "Phone is required").optional(),
        sgst: z.number().min(1, "SGST is required").optional(),
        shopName: z.string().min(1, "Shop name is required"),
        state: z.string().min(1, "State is required").optional(),
        zipCode: z.string().min(1, "Zip code is required").optional()
    })
});

const tenantCreateSchema = z.object({
    body: z.object({
        name: z.string().min(3, "Name must be at least 3 characters").max(100, "Name is too long"),
        subdomain: z.string().min(3, "Subdomain must be at least 3 characters")
            .max(50, "Subdomain is too long")
            .regex(/^[a-zA-Z0-9-]+$/, "Subdomain can only contain letters, numbers, and hyphens"),
       
    })
});

const getTenantsSchema = z.object({
    query: z.object({
        page: z.string().regex(/^\d+$/, "Page must be numeric").optional(),
        limit: z.string().regex(/^\d+$/, "Limit must be numeric").optional(),
        name: z.string().optional(),
        subdomain: z.string().optional(),
        createdAtFrom: z.string().optional(),
        createdAtTo: z.string().optional(),
        sortField: z.string().optional(),
        sortDirection: z.enum(["asc", "desc"]).optional(),
    })
});

const getTenantSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid tenant ID format"),
    })
});

const updateTenantSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid tenant ID format"),
    }),
    body: z.object({
        name: z.string().min(3, "Name must be at least 3 characters").max(100, "Name is too long").optional(),
        subdomain: z.string().min(3, "Subdomain must be at least 3 characters")
            .max(50, "Subdomain is too long")
            .regex(/^[a-zA-Z0-9-]+$/, "Subdomain can only contain letters, numbers, and hyphens")
            .optional(),
       
    })
});

const deleteTenantSchema = z.object({
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid tenant ID format"),
    })
});

export { tenantSettingSchema, tenantCreateSchema, getTenantsSchema, getTenantSchema, updateTenantSchema, deleteTenantSchema };