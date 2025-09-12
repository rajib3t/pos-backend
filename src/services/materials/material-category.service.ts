import { Connection } from "mongoose";
import MaterialCategoryRepository from "../../repositories/materials/material-category.repository";
import { IMaterialCategory } from "../../models/materials/material-category.model";

class MaterialCategoryService {
    private static instance: MaterialCategoryService;

    public static getInstance(): MaterialCategoryService {
        if (!MaterialCategoryService.instance) {
            MaterialCategoryService.instance = new MaterialCategoryService();
        }
        return MaterialCategoryService.instance;
    }


     // Original methods (for backward compatibility with main database)
        public async create(userData: Partial<IMaterialCategory>): Promise<IMaterialCategory>;
        public async create(tenantConnection: Connection, userData: Partial<IMaterialCategory>): Promise<IMaterialCategory>;
        public async create(connectionOrData: Connection | Partial<IMaterialCategory>, userData?: Partial<IMaterialCategory>): Promise<IMaterialCategory> {
            if (connectionOrData instanceof Connection) {
                // Using tenant connection
                const repository = new MaterialCategoryRepository(connectionOrData);
                return repository.create(userData!);
            } else {
                // Using main database (backward compatibility)
                const repository = new MaterialCategoryRepository();
                return repository.create(connectionOrData);
            }
        }
}


export default MaterialCategoryService;