import { Model, Connection } from "mongoose";
import Token, { IToken } from "../models/token.model";
import Logging from "../libraries/logging.library";
import { TenantModelFactory } from "../utils/tenantModelFactory";


export default class TokenRepository {
    private model: Model<IToken>;

    constructor(connection?: Connection) {
        if (connection) {
            // Use tenant-specific connection
            this.model = TenantModelFactory.getTokenModel(connection);
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
        return await this.model.findById(id).exec();
    }

    async revokeToken(id: string): Promise<IToken | null> {
        return await this.model.findByIdAndUpdate(id, { isRevoked: true }, { new: true }).exec();
    }

    async findTokenByUserId(userId: string): Promise<IToken | null> {
        return await this.model.findOne({ userId, isRevoked: false }).exec();
    }


    async invalidateToken(token: string): Promise<void> {
       
        await this.model.findOneAndUpdate({ token }, { isRevoked: true }).exec();
    }

    async findByToken(token: string): Promise<IToken | null> {
        
        return await this.model.findOne({ token, isRevoked: false }).exec();
    }
}

