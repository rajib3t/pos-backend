import { Model, Connection } from "mongoose";
import Address, { IAddress } from "../models/address.model";
import { IUser } from "../models/user.model";
import { TenantModelFactory } from "../utils/tenantModelFactory";

export default class AddressRepository {

    private addressModel: Model<IAddress>;

    constructor(connection?: Connection) {
        if (connection) {
            // Use tenant-specific connection
            this.addressModel = TenantModelFactory.getTenantModel<IAddress>(connection, 'Address', Address.schema);
        } else {
            // Use default master database connection
            this.addressModel = Address;
        }
    }

    async create(user: IUser, addressData: Partial<IAddress>): Promise<IAddress> {
        return this.addressModel.create({ user, ...addressData });
    }

    async findAll(): Promise<IAddress[]> {
        return this.addressModel.find().exec();
    }

    async findById(id: string): Promise<IAddress | null> {
        return this.addressModel.findById(id).exec();
    }

    async update(id: string, addressData: Partial<IAddress>): Promise<IAddress | null> {
        return this.addressModel.findByIdAndUpdate(id, addressData, { new: true }).exec();
    }

    async delete(id: string): Promise<IAddress | null> {
        return this.addressModel.findByIdAndDelete(id).exec();
    }

    async findByUserId(userId: string): Promise<IAddress | null> {
        return this.addressModel.findOne({ userId }).exec();
    }

    async deleteByUserId(userId: string): Promise<{ deletedCount?: number }> {
        return this.addressModel.deleteMany({ userId }).exec();
    }

}