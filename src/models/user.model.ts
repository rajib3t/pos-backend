// src/models/User.ts
import { Schema, model, Document } from 'mongoose';
export interface IUser extends Document {
  name: string;
  email: string;
  mobile?: string;
  password?: string;
  isActive?: boolean;
}
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

export default model<IUser>("User", UserSchema);

