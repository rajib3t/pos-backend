import { Model, Connection } from "mongoose";

import { TenantModelFactory } from "../../utils/tenantModelFactory";
import MaterialCategory, { IMaterialCategory } from "../../models/materials/material-category.model";
import { PaginatedResult, PaginationOptions, Repository } from "../repository";

export default class MaterialCategoryRepository  extends Repository<IMaterialCategory>{
    private materialCategory : Model<IMaterialCategory>;

    constructor(connection?: Connection) {
        super()
        if (connection) {
            // Use tenant-specific connection
            this.materialCategory = TenantModelFactory.getTenantModel<IMaterialCategory>(connection, 'MaterialCategory', MaterialCategory.schema);
        } else {
            // Use default master database connection
            this.materialCategory = MaterialCategory;
        }
    }

    async create(materialCategoryData: Partial<IMaterialCategory>): Promise<IMaterialCategory> {
        return this.materialCategory.create({  ...materialCategoryData });
    }

    async findAll(): Promise<IMaterialCategory[]> {
        return this.materialCategory.find().lean().exec();
    }

    async findById(id: string): Promise<IMaterialCategory | null> {
        return this.materialCategory.findById(id).lean().exec();
    }

    async update(id: string, materialCategoryData: Partial<IMaterialCategory>): Promise<IMaterialCategory | null> {
        return this.materialCategory.findByIdAndUpdate(id, materialCategoryData, { new: true }).lean().exec();
    }

    async delete(id: string): Promise<IMaterialCategory | null> {
        return this.materialCategory.findByIdAndDelete(id).lean().exec();
    }

   

    async deleteByUserId(userId: string): Promise<{ deletedCount?: number }> {
        return this.materialCategory.deleteMany({ userId }).exec();
    }

    async findPaginated(options: PaginationOptions<IMaterialCategory> = {}): Promise<PaginatedResult<IMaterialCategory>> {
        const {
            filter = {},
            page = 1,
            limit = 10,
            sort = { createdAt: -1 },
            projection = {}
        } = options;

        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.materialCategory.find(filter as any, projection).sort(sort).skip(skip).limit(limit).lean().exec(),
            this.materialCategory.countDocuments(filter as any).exec()
        ]);

        return {
            items,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        };
    }
}
