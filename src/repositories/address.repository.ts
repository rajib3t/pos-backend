import { Model, Connection } from "mongoose";
import Address, { IAddress } from "../models/address.model";
import { IUser } from "../models/user.model";
import { TenantModelFactory } from "../utils/tenantModelFactory";
import { PaginatedResult, PaginationOptions, Repository } from "./repository";

export default class AddressRepository extends Repository<IAddress> {

    private addressModel: Model<IAddress>;

    constructor(connection?: Connection) {
        super();
        if (connection) {
            // Use tenant-specific connection
            this.addressModel = TenantModelFactory.getTenantModel<IAddress>(connection, 'Address', Address.schema);
        } else {
            // Use default master database connection
            this.addressModel = Address;
        }
    }

    async create(addressData: Partial<IAddress>): Promise<IAddress> {
        return this.addressModel.create(addressData);
    }

    async findAll(): Promise<IAddress[]> {
        return this.addressModel.find().lean().exec();
    }

    async findById(id: string): Promise<IAddress | null> {
        return this.addressModel.findById(id).lean().exec();
    }

    async update(id: string, addressData: Partial<IAddress>): Promise<IAddress | null> {
        return this.addressModel.findByIdAndUpdate(id, addressData, { new: true }).lean().exec();
    }

    async delete(id: string): Promise<IAddress | null> {
        return this.addressModel.findByIdAndDelete(id).lean().exec();
    }

    async findByUserId(userId: string): Promise<IAddress | null> {
        return this.addressModel.findOne({ userId }).lean().exec();
    }

    async deleteByUserId(userId: string): Promise<{ deletedCount?: number }> {
        return this.addressModel.deleteMany({ userId }).exec();
    }

    async findPaginated(options: PaginationOptions<IAddress> = {}): Promise<PaginatedResult<IAddress>> {
        const {
            filter = {},
            page = 1,
            limit = 10,
            sort = { createdAt: -1 },
            projection = {}
        } = options;

        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.addressModel.find(filter as any, projection).sort(sort).skip(skip).limit(limit).lean().exec(),
            this.addressModel.countDocuments(filter as any).exec()
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