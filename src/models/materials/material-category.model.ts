import { Schema, model, Document } from "mongoose";

export interface IMaterialCategory extends Document{
    name: string;
    code: string;
}


const MaterialCategorySchema : Schema = new Schema(
    {
        name: { type: String, require:true},
        code: { type: String, require:true, unique:true },
    },
    {
        timestamps: true,
        versionKey: false,
    }
)

export default model<IMaterialCategory>("MaterialCategory",MaterialCategorySchema )