import { Connection, Model, Document, Schema } from 'mongoose';
import Logging from '../libraries/logging.library';

export abstract class TenantAwareRepository<T extends Document> {
    protected connection: Connection;
    protected model: Model<T>;
    private modelName: string;
    private schema: Schema;

    constructor(connection: Connection, modelName: string, schema: Schema) {
        this.connection = connection;
        this.modelName = modelName;
        this.schema = schema;
        this.model = this.getOrCreateModel();
    }

    /**
     * Get or create model for the tenant database
     */
    private getOrCreateModel(): Model<T> {
        try {
            // Check if model already exists in this connection
            return this.connection.model<T>(this.modelName);
        } catch (error) {
            // Model doesn't exist, create it
            return this.connection.model<T>(this.modelName, this.schema);
        }
    }

    /**
     * Create a new document
     */
    async create(data: Partial<T>): Promise<T> {
        try {
            const doc = new this.model(data);
            return await doc.save();
        } catch (error) {
            Logging.error(`Error creating ${this.modelName}: ${error}`);
            throw new Error(`Failed to create ${this.modelName}: ${(error as Error).message}`);
        }
    }

    /**
     * Find document by ID
     */
    async findById(id: string): Promise<T | null> {
        try {
            return await this.model.findById(id).exec();
        } catch (error) {
            Logging.error(`Error finding ${this.modelName} by ID: ${error}`);
            throw new Error(`Failed to find ${this.modelName}: ${(error as Error).message}`);
        }
    }

    /**
     * Find all documents with optional filter
     */
    async findAll(filter: any = {}): Promise<T[]> {
        try {
            return await this.model.find(filter).exec();
        } catch (error) {
            Logging.error(`Error finding all ${this.modelName}: ${error}`);
            throw new Error(`Failed to find ${this.modelName}s: ${(error as Error).message}`);
        }
    }

    /**
     * Find one document by filter
     */
    async findOne(filter: any): Promise<T | null> {
        try {
            return await this.model.findOne(filter).exec();
        } catch (error) {
            Logging.error(`Error finding one ${this.modelName}: ${error}`);
            throw new Error(`Failed to find ${this.modelName}: ${(error as Error).message}`);
        }
    }

    /**
     * Update document by ID
     */
    async update(id: string, data: Partial<T>): Promise<T | null> {
        try {
            return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
        } catch (error) {
            Logging.error(`Error updating ${this.modelName}: ${error}`);
            throw new Error(`Failed to update ${this.modelName}: ${(error as Error).message}`);
        }
    }

    /**
     * Delete document by ID
     */
    async delete(id: string): Promise<T | null> {
        try {
            return await this.model.findByIdAndDelete(id).exec();
        } catch (error) {
            Logging.error(`Error deleting ${this.modelName}: ${error}`);
            throw new Error(`Failed to delete ${this.modelName}: ${(error as Error).message}`);
        }
    }

    /**
     * Count documents with optional filter
     */
    async count(filter: any = {}): Promise<number> {
        try {
            return await this.model.countDocuments(filter).exec();
        } catch (error) {
            Logging.error(`Error counting ${this.modelName}: ${error}`);
            throw new Error(`Failed to count ${this.modelName}s: ${(error as Error).message}`);
        }
    }

    /**
     * Find with pagination
     */
    async findWithPagination(
        filter: any = {},
        page: number = 1,
        limit: number = 10,
        sort: any = { createdAt: -1 }
    ): Promise<{ data: T[]; total: number; page: number; totalPages: number }> {
        try {
            const skip = (page - 1) * limit;
            const [data, total] = await Promise.all([
                this.model.find(filter).sort(sort).skip(skip).limit(limit).exec(),
                this.model.countDocuments(filter).exec()
            ]);

            const totalPages = Math.ceil(total / limit);

            return {
                data,
                total,
                page,
                totalPages
            };
        } catch (error) {
            Logging.error(`Error in paginated find for ${this.modelName}: ${error}`);
            throw new Error(`Failed to find ${this.modelName}s with pagination: ${(error as Error).message}`);
        }
    }

    /**
     * Bulk create documents
     */
    async bulkCreate(dataArray: Partial<T>[]): Promise<T[]> {
        try {
            const result = await this.model.insertMany(dataArray);
            return result as unknown as T[];
        } catch (error) {
            Logging.error(`Error in bulk create for ${this.modelName}: ${error}`);
            throw new Error(`Failed to bulk create ${this.modelName}s: ${(error as Error).message}`);
        }
    }

    /**
     * Get the underlying Mongoose model
     */
    getModel(): Model<T> {
        return this.model;
    }

    /**
     * Get the database connection
     */
    getConnection(): Connection {
        return this.connection;
    }
}
