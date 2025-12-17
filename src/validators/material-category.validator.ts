import { z } from "zod";


const createMaterialCategorySchema = z.object({
    params: z.object({
        storeID: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid store ID format"),
    }),
    body: z.object({
        name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
        code: z.string().trim().min(1, "Code is required").max(20, "Code is too long").uppercase().optional(),
        
    }),
})

const updateMaterialCategorySchema = z.object({
    params: z.object({
        storeID: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid store ID format"),
        categoryID: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid category ID format"),
    }),
    body: z.object({
        name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
        code: z.string().trim().min(1, "Code is required").max(20, "Code is too long").uppercase().optional(),
        
    }),
})

const getMaterialCategorySchema = z.object({
    params: z.object({
        storeID: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid store ID format"),
        categoryID: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid category ID format"),
    }),
})

const deleteMaterialCategorySchema = z.object({
    params: z.object({
        storeID: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid store ID format"),
        categoryID: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid category ID format"),
    }),
})

const getAllMaterialCategoriesSchema = z.object({
    params: z.object({
        storeID: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid store ID format"),
    }),
})  

export {
    createMaterialCategorySchema,
    updateMaterialCategorySchema,
    getMaterialCategorySchema,
    deleteMaterialCategorySchema,
    getAllMaterialCategoriesSchema
}