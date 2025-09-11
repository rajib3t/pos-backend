import { Model, Connection } from "mongoose";
import Setting, { ISetting } from "../models/setting.model";
import { TenantModelFactory } from "../utils/tenantModelFactory";
import { PaginatedResult, PaginationOptions, Repository } from "./repository";
export default class SettingRepository  extends Repository<ISetting> {
    private model: Model<ISetting>;

    constructor(connection?: Connection) {
        super();
        if (connection) {
            // Use tenant-specific connection
            this.model = TenantModelFactory.getTenantModel<ISetting>(connection, 'Setting', Setting.schema);
        } else {
            // Use default master database connection
            this.model = Setting;
        }
    }



    async create(data: Partial<ISetting>): Promise<ISetting> {
        return await this.model.create(data);
    }

    async findAll(): Promise<ISetting[]> {
        return await this.model.find().lean().exec();
    }

    async findById(id: string): Promise<ISetting | null> {
        return await this.model.findById(id).lean().exec();
    }

    async update(id: string, data: Partial<ISetting>): Promise<ISetting | null> {
        return await this.model.findByIdAndUpdate(id, data, { new: true }).lean().exec();
    }

    async delete(id: string): Promise<ISetting | null> {
        return await this.model.findByIdAndDelete(id).lean().exec();
    }

    async findByKey(condition: { [key: string]: any }): Promise<ISetting | null> {
        return await this.model.findOne(condition).lean().exec();
    }

    async findPaginated(options: PaginationOptions<ISetting> = {}): Promise<PaginatedResult<ISetting>> {
        const {
            filter = {},
            page = 1,
            limit = 10,
            sort = { createdAt: -1 },
            projection = {}
        } = options;

        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.model.find(filter as any, projection).sort(sort).skip(skip).limit(limit).lean().exec(),
            this.model.countDocuments(filter as any).exec()
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