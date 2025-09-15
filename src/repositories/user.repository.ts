// src/repositories/user.repository.ts
import { Model } from 'mongoose';
import User ,{ IUser,  } from '../models/user.model';
import { PaginatedResult, PaginationOptions, Repository } from './repository';
import BaseRepository from './base.repository';
import { Connection } from 'mongoose';

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
        super(User, 'User', connection);
        
        
       
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

    
    
}