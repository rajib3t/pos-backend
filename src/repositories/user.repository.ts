// src/repositories/user.repository.ts
import { Model } from 'mongoose';
import User ,{ IUser,  } from '../models/user.model';
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
        if(!connection) {
            super(User);
        }else{
            super(User, 'User', connection);
        }
       
        
        
       
    }

   
    async findByEmail(email: string): Promise<IUser | null> {
        return this.model.findOne({ email }).lean().exec();
    }

    

    async findByMobile(mobile: string): Promise<IUser | null> {
        return this.model.findOne({ mobile }).lean().exec();
    }

    async getUserProfile(userId: string): Promise<IUser | null> {
        return this.model.findById(userId).lean().exec();
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