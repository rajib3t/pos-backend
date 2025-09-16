// src/models/User.ts
import { Schema, model, Document } from 'mongoose';
import "./address.model"; // Ensure Address schema is registered before use

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
      password: { type: String, required: true },
      
    },
    {
      timestamps: true,
      versionKey: false
    }
);
// virtual populate
UserSchema.virtual("addresses", {
  ref: "Address",          // model to use
  localField: "_id",       // field on User
  foreignField: "userId",  // field on Address
  justOne: false           // set true if you expect only one address
});

export default model<IUser>("User", UserSchema);

