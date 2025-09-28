import { Schema, model, Document } from "mongoose";
import { IUser } from "../user.model";
import { tr } from "zod/locales";
export interface IMaterialCategory extends Document{
    name: string;
    code: string;
    createdBy?: IUser["_id"];
    updatedBy?: IUser["_id"];
    createdAt?: Date;
    updatedAt?: Date;
}


const MaterialCategorySchema : Schema = new Schema(
    {
        name: { type: String, required: true},
        code: { type: String, required: true, unique: true },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" , required: true},
        updatedBy:{type: Schema.Types.ObjectId, ref: "User" },
    },
    {
        timestamps: true,
        versionKey: false,
    }
)

export default model<IMaterialCategory>("MaterialCategory",MaterialCategorySchema )