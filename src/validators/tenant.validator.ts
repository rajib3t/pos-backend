import z from "zod";

const tenantSettingSchema = z.object({
    body: z.object({
        address1: z.string().min(1, "Address 1 is required").optional(),
        address2: z.string().optional(),
        cgst: z.string().min(1, "CGST is required").optional(),
        city: z.string().min(1, "City is required").optional(),
        code: z.string().min(1, "Code is required").uppercase().optional(),
        country: z.string().min(1, "Country is required").optional(),
        currency: z.string().min(1, "Currency is required").optional(),
        email: z.string().trim().pipe(z.email()).optional(),
        fassi: z.string().optional(),
        gstNumber: z.string().min(1, "GST Number is required").optional(),
        phone: z.string().min(1, "Phone is required").optional(),
        sgst: z.string().min(1, "SGST is required").optional(),
        shopName: z.string().min(1, "Shop name is required"),
        state: z.string().min(1, "State is required").optional(),
        zipCode: z.string().min(1, "Zip code is required").optional()
    })
});

export { tenantSettingSchema };