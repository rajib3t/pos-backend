import { z } from "zod";


const loginSchema = z.object({
    body: z.object({
        email: z.string().trim().pipe(z.email()),
        password: z.string().min(6),
    }),
});

export { loginSchema };


const registerSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Name is required").max(100, "Name is too long"),
        email: z.string().trim().pipe(z.email()),
        password: z.string().min(6, "Password must be at least 6 characters"),
    }),
});

export { registerSchema };