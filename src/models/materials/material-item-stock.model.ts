import { Schema, model, Document } from "mongoose";
import { IMaterialItem } from "./material-item.model";
export interface IMaterialItemStock extends Document {
    materialItem: IMaterialItem["_id"];
    quantity: number;
    location: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const MaterialItemStockSchema: Schema = new Schema(
    {
        materialItem: { type: Schema.Types.ObjectId, ref: "MaterialItem", required: true },
        quantity: { type: Number, required: true, default: 0 },
        location: { type: String, required: true },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// Indexes for query optimization
MaterialItemStockSchema.index({ materialItem: 1 });
MaterialItemStockSchema.index({ location: 1 });
MaterialItemStockSchema.index({ createdAt: -1 });

export default model<IMaterialItemStock>("MaterialItemStock", MaterialItemStockSchema);