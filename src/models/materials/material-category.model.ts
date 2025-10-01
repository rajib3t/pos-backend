import { Schema, model, Document } from "mongoose";
import { IUser } from "../user.model";
import { IStore } from "../store/store.model";

export interface IMaterialCategory extends Document {
    name: string;
    code: string;
    store: IStore["_id"];
    createdBy?: IUser["_id"];
    updatedBy?: IUser["_id"];
    createdAt?: Date;
    updatedAt?: Date;
}

const MaterialCategorySchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        code: { type: String, required: true }, // Remove unique: true
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
MaterialCategorySchema.index(
    { name: 1, store: 1 }, 
    { unique: true, name: 'unique_name_per_store' }
);

MaterialCategorySchema.index(
    { code: 1, store: 1 }, 
    { unique: true, name: 'unique_code_per_store' }
);

// Additional indexes for query optimization
MaterialCategorySchema.index({ store: 1, createdBy: 1 });
MaterialCategorySchema.index({ createdAt: -1 });

export default model<IMaterialCategory>("MaterialCategory", MaterialCategorySchema);