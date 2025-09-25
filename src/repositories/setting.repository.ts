import { Model, Connection } from "mongoose";
import Setting, { ISetting } from "../models/setting.model";
import { TenantModelFactory } from "../utils/tenantModelFactory";
import { PaginatedResult, PaginationOptions, Repository } from "./repository";
import BaseRepository from "./base.repository";
export default class SettingRepository  extends BaseRepository<ISetting> {
   

    constructor(connection?: Connection) {
        if (connection) {
                   super(Setting, 'Setting', connection);
                   
                } else {
                    // Use default master database connection
                    super(Setting);
                }
       
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