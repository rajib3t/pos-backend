import { Schema, model, Document } from "mongoose";
import { IUser } from "./user.model";
export interface IAddress extends Document {
  userId: IUser;
  street: string;
  city: string;
  state: string;
  zip: string;
}

const AddressSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zip: { type: String, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export default model<IAddress>("Address", AddressSchema);
