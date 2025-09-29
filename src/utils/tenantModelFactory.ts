import { Connection, Model, Schema } from 'mongoose';
import { IUser } from '../models/user.model';
import { ITenant } from '../models/tenant.model';
import { IAddress } from '../models/address.model';
import { IToken } from '../models/token.model';
import { IStore } from '../models/store/store.model';
import { IStoreMembership } from '../models/store/storeMembership.model';

// Import existing schemas
import UserModel from '../models/user.model';
import AddressModel from '../models/address.model';
import TokenModel from '../models/token.model';
import StoreModel from '../models/store/store.model';
import StoreMembershipModel from '../models/store/storeMembership.model';

export class TenantModelFactory {
    private static modelCache: Map<string, Map<string, Model<any>>> = new Map();

    /**
     * Get model for tenant database connection
     */
    public static getModel<T>(
        connection: Connection,
        modelName: string,
        schema: Schema
    ): Model<T> {
        const connectionId = (connection.id || connection.name || 'default').toString();
        
        // Check cache first
        if (!this.modelCache.has(connectionId)) {
            this.modelCache.set(connectionId, new Map());
        }

        const connectionCache = this.modelCache.get(connectionId)!;
        
        if (connectionCache.has(modelName)) {
            return connectionCache.get(modelName) as Model<T>;
        }

        // Create model and cache it
        try {
            // Check if model already exists in connection
            const model = connection.model<T>(modelName);
            connectionCache.set(modelName, model);
            return model;
        } catch (error) {
            // Model doesn't exist, create it
            const model = connection.model<T>(modelName, schema);
            connectionCache.set(modelName, model);
            return model;
        }
    }
    /**
     * Generic method to get any model for tenant
     */
    public static getTenantModel<T>(connection: Connection, modelName: string, schema: Schema): Model<T> {
        return this.getModel<T>(connection, modelName, schema);
    }
    /**
     * Get User model for tenant
     */
    public static getUserModel(connection: Connection): Model<IUser> {
        // Extract schema from existing model
        const userSchema = UserModel.schema;
        return this.getModel<IUser>(connection, 'User', userSchema);
    }

    /**
     * Get Address model for tenant
     */
    public static getAddressModel(connection: Connection): Model<IAddress> {
        const addressSchema = AddressModel.schema;
        return this.getModel<IAddress>(connection, 'Address', addressSchema);
    }

    /**
     * Get Token model for tenant
     */
    public static getTokenModel(connection: Connection): Model<IToken> {
        const tokenSchema = TokenModel.schema;
        return this.getModel<IToken>(connection, 'Token', tokenSchema);
    }

    /**
     * Get Store model for tenant
     */
    public static getStoreModel(connection: Connection): Model<IStore> {
        const storeSchema = StoreModel.schema;
        return this.getModel<IStore>(connection, 'Store', storeSchema);
    }

    /**
     * Get StoreMembership model for tenant
     */
    public static getStoreMembershipModel(connection: Connection): Model<IStoreMembership> {
        const storeMembershipSchema = StoreMembershipModel.schema;
        return this.getModel<IStoreMembership>(connection, 'StoreMembership', storeMembershipSchema);
    }

    /**
     * Clear cache for a specific connection
     */
    public static clearConnectionCache(connectionId: string): void {
        this.modelCache.delete(connectionId);
    }

    /**
     * Clear all cache
     */
    public static clearAllCache(): void {
        this.modelCache.clear();
    }
}
