import { Schema, model, Document } from "mongoose";
import { IUser } from "./user.model";

export interface IToken extends Document {
  user: IUser;
  type: string;
  token: string;
  isRevoked: boolean;
  expiresAt: Date;
}

const tokenSchema = new Schema<IToken>(
    {
        user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
        type: { type: String, required: true },
        token: { type: String, required: true },
        isRevoked: { type: Boolean, default: false },
        expiresAt: { type: Date, required: true },
    },
    {
        timestamps: true,
        versionKey: false
    }
);

export default model<IToken>("Token", tokenSchema);
