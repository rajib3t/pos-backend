import { Schema, model, Document } from "mongoose";
import { ITenant } from "./tenant.model";
export interface ISetting extends Document {
  tenant: ITenant["_id"];
  shopName?: string;
  code?: string;
  address?: string;
  address2?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  currency?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  fassi ?: string;
  gstNumber ?: string;
  sgst ?: string;
  cgst ?: string;
  
}

const SettingSchema: Schema = new Schema(
  {
    tenant: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },
    shopName: { type: String , required: true },
    code: { type: String , required:true},
    address: { type: String },
    address2: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    zipCode: { type: String },
    currency: { type: String },
    phone: { type: String },
    email: { type: String },
    logoUrl: { type: String },
    fassi : { type : String },
    gstNumber : { type : String },
    sgst : { type : String },
    cgst : { type : String },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export default model<ISetting>("Setting", SettingSchema);