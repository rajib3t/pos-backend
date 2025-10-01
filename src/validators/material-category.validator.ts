import { z } from "zod";


const createMaterialCategorySchema = z.object({
    params: z.object({
        storeID: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid store ID format"),
    }),
    body: z.object({
        name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
        code: z.string().trim().min(1, "Code is required").max(20, "Code is too long").uppercase(),
        
    }),
})


export {
    createMaterialCategorySchema
}