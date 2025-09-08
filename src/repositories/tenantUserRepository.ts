import { Connection, Schema } from 'mongoose';
import { TenantAwareRepository } from './tenantAwareRepository';
import { IUser } from '../models/user.model';

// Define the schema (can be shared across tenants)
const UserSchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        mobile: { type: String, required: false },
        isActive: { type: Boolean, default: true },
        password: { type: String, required: true }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

export class TenantUserRepository extends TenantAwareRepository<IUser> {
    constructor(connection: Connection) {
        super(connection, 'User', UserSchema);
    }

    /**
     * Find user by email
     */
    async findByEmail(email: string): Promise<IUser | null> {
        return this.findOne({ email });
    }

    /**
     * Find active users
     */
    async findActiveUsers(): Promise<IUser[]> {
        return this.findAll({ isActive: true });
    }

    /**
     * Update user password
     */
    async updatePassword(userId: string, hashedPassword: string): Promise<IUser | null> {
        return this.update(userId, { password: hashedPassword });
    }

    /**
     * Deactivate user
     */
    async deactivateUser(userId: string): Promise<IUser | null> {
        return this.update(userId, { isActive: false });
    }

    /**
     * Search users by name or email
     */
    async searchUsers(searchTerm: string): Promise<IUser[]> {
        const regex = new RegExp(searchTerm, 'i');
        return this.findAll({
            $or: [
                { name: { $regex: regex } },
                { email: { $regex: regex } }
            ]
        });
    }
}
