import { z } from "zod";
import { errorResponse } from "../utils/errorResponse";
import UserService from "../services/user.service";
const loginSchema = z.object({
    body: z.object({
        email: z.string().trim().pipe(z.email()),
        password: z.string().min(6),
    }),
});

export { loginSchema };




// Simple schema without async validation - async check will be done in controller
const registerSchema = z.object({
    body: z.object({
        name: z.string().min(1, "Name is required").max(100, "Name is too long"),
        email: z.string().trim().pipe(z.email()),
        password: z.string().min(6, "Password must be at least 6 characters"),
    })
});



export { registerSchema };