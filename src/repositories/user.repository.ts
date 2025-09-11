// src/repositories/user.repository.ts
import { Model } from 'mongoose';
import User ,{ IUser,  } from '../models/user.model';
import { PaginatedResult, PaginationOptions, Repository } from './repository';


export interface IProfileData extends IUser {
    address?: {
        street: string;
        city: string;
        state: string;
        zip: string;
    }
}
export class UserRepository extends Repository<IUser> {
    private userModel: Model<IUser>;

    constructor() {
        super();
        this.userModel = User;
    }

    async create(userData: Partial<IUser>): Promise<IUser> {
        return this.userModel.create(userData);
    }

    async findAll(): Promise<IUser[]> {
        return this.userModel.find().lean().exec();
    }

    async findByEmail(email: string): Promise<IUser | null> {
        return this.userModel.findOne({ email }).lean().exec();
    }

    async findById(id: string): Promise<IUser | null> {
        return this.userModel.findById(id).lean().exec();
    }

    async update(id: string, userData: Partial<IUser>): Promise<IUser | null> {
        return this.userModel.findByIdAndUpdate(id, userData, { new: true }).lean().exec();
    }

    async delete(id: string): Promise<IUser | null> {
        return this.userModel.findByIdAndDelete(id).lean().exec();
    }

    async findByMobile(mobile: string): Promise<IUser | null> {
        return this.userModel.findOne({ mobile }).lean().exec();
    }

    async getUserProfile(userId: string): Promise<IUser | null> {
        return this.userModel.findById(userId).lean().exec();
    }

    async findPaginated(options: PaginationOptions<IUser> = {}): Promise<PaginatedResult<IUser>> {
        const {
            filter = {},
            page = 1,
            limit = 10,
            sort = { createdAt: -1 },
            projection = {}
        } = options;

        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.userModel.find(filter as any, projection).sort(sort).skip(skip).limit(limit).lean().exec(),
            this.userModel.countDocuments(filter as any).exec()
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