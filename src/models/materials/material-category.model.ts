import { Schema, model, Document } from "mongoose";
import { IUser } from "../user.model";
export interface IMaterialCategory extends Document{
    name: string;
    code: string;
    createdBy?: IUser["_id"];
}


const MaterialCategorySchema : Schema = new Schema(
    {
        name: { type: String, required: true},
        code: { type: String, required: true, unique: true },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" , required: true},
    },
    {
        timestamps: true,
        versionKey: false,
    }
)

export default model<IMaterialCategory>("MaterialCategory",MaterialCategorySchema )