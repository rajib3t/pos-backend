import { z } from "zod";

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

export { profileUpdateSchema };