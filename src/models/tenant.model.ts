import { Schema, model, Document } from 'mongoose';
import { ISetting } from './setting.model';
export interface ITenant extends Document {
    name: string;
    subdomain: string;
    databaseName: string;
    databaseUser: string;
    databasePassword: string;
    settings?: ISetting
}

const TenantSchema :Schema = new Schema(
    {
        name: { type: String, required: true },
        subdomain: { type: String, required: true, unique: true },
        databaseName: { type: String, required: true },
        databaseUser: { type: String, required: true },
        databasePassword: { type: String, required: true },
        settings: { type: Schema.Types.ObjectId, ref: 'Setting' }
    },
    {
        timestamps: true,
        versionKey: false
    }
);


export default model<ITenant>("Tenant", TenantSchema);