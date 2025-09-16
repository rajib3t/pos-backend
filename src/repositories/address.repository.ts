import { Model, Connection } from "mongoose";
import Address, { IAddress } from "../models/address.model";
import { IUser } from "../models/user.model";
import { TenantModelFactory } from "../utils/tenantModelFactory";
import { PaginatedResult, PaginationOptions, Repository } from "./repository";
import BaseRepository from "./base.repository";

export default class AddressRepository extends BaseRepository<IAddress> {

    
    constructor(connection?: Connection) {
        
        if (connection) {
           super(Address, 'Address', connection);
           
        } else {
            // Use default master database connection
            super(Address);
        }
    }

  

    async findByUserId(userId: string): Promise<IAddress | null> {
        return this.model.findOne({ userId }).lean().exec();
    }

    async deleteByUserId(userId: string): Promise<{ deletedCount?: number }> {
        return this.model.deleteMany({ userId }).exec();
    }

    

}