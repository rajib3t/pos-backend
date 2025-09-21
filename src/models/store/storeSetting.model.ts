import { Schema, model, Document } from "mongoose";
import { IStore } from "./store.model";

export interface IStoreSetting extends Document {
    store: IStore["_id"];
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
    fssai?: string; // changed from fassi to fssai if that's intended
    gstNumber?: string;
    sgst?: string;
    cgst?: string;
}

const StoreSettingSchema: Schema = new Schema(
    {
        store: { type: Schema.Types.ObjectId, ref: "Store", required: true, unique: true },
        address: { type: String, trim: true, default: null },
        address2: { type: String, trim: true, default: null },
        city: { type: String, trim: true, default: null },
        state: { type: String, trim: true, default: null },
        country: { type: String, trim: true, default: null },
        zipCode: { type: String, trim: true, default: null },
        currency: { type: String, trim: true, default: null },
        phone: { type: String, trim: true, default: null },
        email: { 
            type: String, 
            trim: true, 
            default: null,
            match: [/^\S+@\S+\.\S+$/, "Please enter a valid email address"]
        },
        logoUrl: { type: String, trim: true, default: null },
        fssai: { type: String, trim: true, default: null },
        gstNumber: { type: String, trim: true, default: null },
        sgst: { type: String, trim: true, default: null },
        cgst: { type: String, trim: true, default: null },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

export default model<IStoreSetting>("StoreSetting", StoreSettingSchema);