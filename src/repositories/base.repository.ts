
import { PaginatedResult, PaginationOptions, Repository } from "./repository";
import { Model, Connection } from "mongoose";
import { TenantModelFactory } from "../utils/tenantModelFactory";

class BaseRepository< TEntity = any, TCreate = any, TUpdate = any> extends Repository<TEntity, TCreate, TUpdate>{
    public model: Model<TEntity>;
    constructor(model : Model<TEntity>,  connection?: Connection) {
        super();
        if (connection) {
            // Use tenant-specific connection
            this.model = TenantModelFactory.getTenantModel<TEntity>(connection, 'Address', model.schema);
        } else {
            // Use default master database connection
            this.model = model;
        }
    }

    async create(data: TCreate): Promise<TEntity> {
        try {
            const created = await this.model.create(data);
            return created.toObject() as TEntity;
        } catch (error) {
            throw new Error("Create error: " + (error as Error).message);
        }
    }
    async findAll(): Promise<TEntity[]> {
        try {
            return await this.model.find().lean().exec() as TEntity[] ;
        } catch (error) {
            throw new Error("Find all error: " + (error as Error).message);
        }
    }
    async findById(id: string): Promise<TEntity | null> {
        try {
            return this.model.findById(id).lean().exec() as TEntity | null;
        } catch (error) {
            throw new Error("Find by ID error: " + (error as Error).message);
        }
    }
    async update(id: string, data: TUpdate): Promise<TEntity | null> {
        try {
            return await this.model.findByIdAndUpdate(id, data as any, { new: true }).lean().exec() as TEntity | null;
        } catch (error) {
            throw new Error("Update error: " + (error as Error).message);
        }
    }
    async delete(id: string): Promise<TEntity | null | { deletedCount?: number; }> {
        try {
            return await this.model.findByIdAndDelete(id);
        } catch (error) {
            throw new Error("Delete error: " + (error as Error).message);
        }
    }
    async findPaginated(options?: PaginationOptions<TEntity> | undefined): Promise<PaginatedResult<TEntity>> {
        try {
            const {
                filter = {},
                page = 1,
                limit = 10,
                sort = { createdAt: -1 },
                projection = {}
            } = options || {};

            const skip = (page - 1) * limit;
            const [items, total] = await Promise.all([
               await this.model.find(filter as any, projection).sort(sort).skip(skip).limit(limit).lean().exec(),
               await this.model.countDocuments(filter as any).exec()
            ]);

            return {
                items: items as TEntity[],
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            };
        } catch (error) {
            throw new Error("Find paginated error: " + (error as Error).message);
        }
    }
}

export default BaseRepository;
        