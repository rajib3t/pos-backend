// src/models/User.ts
import { Schema, model, Document } from 'mongoose';
import "./address.model"; // Ensure Address schema is registered before use

export interface IUser extends Document {
  name: string;
  email: string;
  mobile?: string;
  password?: string;
  status?: boolean;
  role?: 'admin' | 'staff' | 'manager' | 'owner';
  addresses?: any[]; // This will hold the populated addresses

}
const UserSchema: Schema = new Schema(
    {
      name: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      mobile: { type: String, required: false , unique: true, sparse: true },
      status: { type: Boolean, default: true },
      password: { type: String, required: true },
      role: { type: String, enum: ['admin', 'staff', 'manager', 'owner'], default: 'staff' }
      
    },
    {
      timestamps: true,
      versionKey: false
    }
);
// virtual populate
// Virtual populate for addresses
UserSchema.virtual("addresses", {
  ref: "Address",          // model to use
  localField: "_id",       // field on User
  foreignField: "userId",  // field on Address
  justOne: false           // set true if you expect only one address
});

// Additional indexes for better query performance
UserSchema.index({ status: 1 }); // Index for status-based queries
UserSchema.index({ role: 1 }); // Index for role-based queries
UserSchema.index({ createdAt: -1 }); // Index for sorting by creation date
UserSchema.index({ email: 1, status: 1 }); // Compound index for email + status queries

export default model<IUser>("User", UserSchema);

