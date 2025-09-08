import { Schema, model, Document } from 'mongoose';

export interface ITenant extends Document {
    name: string;
    subdomain: string;
    databaseName: string;
    databaseUser: string;
    databasePassword: string;
}

const TenantSchema :Schema = new Schema(
    {
        name: { type: String, required: true },
        subdomain: { type: String, required: true, unique: true },
        databaseName: { type: String, required: true },
        databaseUser: { type: String, required: true },
        databasePassword: { type: String, required: true },
    },
    {
        timestamps: true,
        versionKey: false
    }
);


export default model<ITenant>("Tenant", TenantSchema);