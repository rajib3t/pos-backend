import { Model } from 'mongoose';
import User, { IUser } from '../models/user.model';
import { PaginatedResult, PaginationOptions, Repository } from './repository';
import BaseRepository from './base.repository';
import { Connection } from 'mongoose';
import AddressModel from '../models/address.model';

export interface IProfileData extends IUser {
    address?: {
        street: string;
        city: string;
        state: string;
        zip: string;
    }
}

export class UserRepository extends BaseRepository<IUser> {
    constructor(connection?: Connection) {
        // Pass the model name when using tenant connection
        if (connection) {
            super(User, 'User', connection);
        } else {
            super(User);
        }
    }

    async findByEmail(email: string): Promise<IUser | null> {
        return this.model.findOne({ email }).lean().exec();
    }

    async findByMobile(mobile: string): Promise<IUser | null> {
        return this.model.findOne({ mobile }).lean().exec();
    }


    async findById(userId: string, options?: { populate?: any; projection?: any; lean?: boolean }): Promise<IUser | null> {
        const { populate, projection = {}, lean = true } = options || {};
        let query = this.model.findById(userId, projection);
        if (populate) {
            // Use any cast on query to avoid union type complexity
            (query as any) = (query as any).populate(populate);
        }
        if (lean) {
            return await query.lean().exec();
        } else {
            return await query.exec();
        }
    }

    async getUserProfileWithAddress(userId: string): Promise<IProfileData | null> {
        const user = await this.model.findById(userId).lean().exec();
        if (!user) {
            return null;
        }
        
        // For main database, use the imported Address model
        const address = await AddressModel.findOne({ userId }).lean().exec();
        
        return {
            ...user,
            address: address ? {
                street: address.street,
                city: address.city,
                state: address.state,
                zip: address.zip
            } : undefined
        } as IProfileData;
    }
}