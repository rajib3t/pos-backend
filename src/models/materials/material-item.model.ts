import { Schema, model, Document } from "mongoose";
import { IUser } from "../user.model";
import { IStore } from "../store/store.model";
import { IMaterialCategory } from "./material-category.model";

export interface IMaterialItem extends Document {
    name: string;
    code: string;
    category: IMaterialCategory["_id"];
    store: IStore["_id"];
    createdBy?: IUser["_id"];
    updatedBy?: IUser["_id"];
    createdAt?: Date;
    updatedAt?: Date;
}


const MaterialItemSchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        code: { type: String, required: true }, // Remove unique: true
        category: { type: Schema.Types.ObjectId, ref: "MaterialCategory", required: true },
        store: { type: Schema.Types.ObjectId, ref: "Store", required: true },
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
        updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// Compound unique indexes (code and name are unique per store)
MaterialItemSchema.index(
    { name: 1, store: 1 }, 
    { unique: true, name: 'unique_name_per_store' }
);

MaterialItemSchema.index(
    { code: 1, store: 1 }, 
    { unique: true, name: 'unique_code_per_store' }
);

// Additional indexes for query optimization
MaterialItemSchema.index({ store: 1, createdBy: 1 });
MaterialItemSchema.index({ createdAt: -1 });

export default model<IMaterialItem>("MaterialItem", MaterialItemSchema);