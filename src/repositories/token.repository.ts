import { Model, Connection } from "mongoose";
import Token, { IToken } from "../models/token.model";
import { TenantModelFactory } from "../utils/tenantModelFactory";


export default class TokenRepository {
    private model: Model<IToken>;

    constructor(connection?: Connection) {
        if (connection) {
            // Use tenant-specific connection
            this.model = TenantModelFactory.getTenantModel<IToken>(connection, 'Token', Token.schema);
        } else {
            // Use default master database connection
            this.model = Token;
        }
    }

    async createToken(data: IToken): Promise<IToken> {
        const token = new this.model(data);
        return  await token.save();
    }

    async findTokenById(id: string): Promise<IToken | null> {
        return await this.model.findById(id).lean().exec();
    }

    async revokeToken(id: string): Promise<IToken | null> {
        return await this.model.findByIdAndUpdate(id, { isRevoked: true }, { new: true }).exec();
    }

    async findTokenByUserId(userId: string): Promise<IToken | null> {
        return await this.model.findOne({ userId, isRevoked: false }).lean().exec();
    }


    async invalidateToken(token: string): Promise<void> {
        await this.model.findOneAndUpdate({ token }, { isRevoked: true }).lean().exec();
    }

    async findByToken(token: string): Promise<IToken | null> {
        return await this.model.findOne({ token, isRevoked: false }).lean().exec();
    }

    async findPaginated(options: { filter?: any; page?: number; limit?: number; sort?: Record<string, 1 | -1>; projection?: Record<string, 0 | 1> } = {}) {
        const {
            filter = {},
            page = 1,
            limit = 10,
            sort = { createdAt: -1 },
            projection = {}
        } = options;

        const skip = (page - 1) * limit;
        const [items, total] = await Promise.all([
            this.model.find(filter, projection).sort(sort).skip(skip).limit(limit).lean().exec(),
            this.model.countDocuments(filter).exec()
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

