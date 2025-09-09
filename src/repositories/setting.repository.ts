import { Model, Connection } from "mongoose";
import Setting, { ISetting } from "../models/setting.model";
import { TenantModelFactory } from "../utils/tenantModelFactory";

export default class SettingRepository {
    private model: Model<ISetting>;

    constructor(connection?: Connection) {
        if (connection) {
            // Use tenant-specific connection
            this.model = TenantModelFactory.getTenantModel<ISetting>(connection, 'Setting', Setting.schema);
        } else {
            // Use default master database connection
            this.model = Setting;
        }
    }

    async createSetting(data: Partial<ISetting>): Promise<ISetting> {
        const setting = new this.model(data);
        return await setting.save();
    }

    async findSettingById(id: string): Promise<ISetting | null> {
        return await this.model.findById(id).exec();
    }

    async updateSetting(id: string, data: Partial<ISetting>): Promise<ISetting | null> {
        return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
    }

    async deleteSetting(id: string): Promise<ISetting | null> {
        return await this.model.findByIdAndDelete(id).exec();
    }

    async findByKey(condition: { [key: string]: any }): Promise<ISetting | null> {
        return await this.model.findOne(condition).exec();
    }
}