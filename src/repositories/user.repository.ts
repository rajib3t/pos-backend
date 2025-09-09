// src/repositories/user.repository.ts
import { Model } from 'mongoose';
import User ,{ IUser,  } from '../models/user.model';


export interface IProfileData extends IUser {
    address?: {
        street: string;
        city: string;
        state: string;
        zip: string;
    }
}
export class UserRepository {
    private userModel: Model<IUser>;

    constructor() {
        this.userModel = User;
    }

    async create(userData: Partial<IUser>): Promise<IUser> {
        return this.userModel.create(userData);
    }

    async findAll(): Promise<IUser[]> {
        return this.userModel.find().exec();
    }

    async findByEmail(email: string): Promise<IUser | null> {
        return this.userModel.findOne({ email }).exec();
    }

    async findById(id: string): Promise<IUser | null> {
        return this.userModel.findById(id).exec();
    }

    async update(id: string, userData: Partial<IUser>): Promise<IUser | null> {
        return this.userModel.findByIdAndUpdate(id, userData, { new: true }).exec();
    }

    async delete(id: string): Promise<IUser | null> {
        return this.userModel.findByIdAndDelete(id).exec();
    }

    async findByMobile(mobile: string): Promise<IUser | null> {
        return this.userModel.findOne({ mobile }).exec();
    }

    async getUserProfile(userId: string): Promise<IProfileData | null> {
        return this.userModel.findById(userId).exec();
    }
    
}