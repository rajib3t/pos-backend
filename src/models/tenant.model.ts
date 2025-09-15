import { Schema, model, Document } from 'mongoose';
import { ISetting } from './setting.model';
import { IUser } from './user.model';
export interface ITenant extends Document {
    name: string;
    subdomain: string;
    databaseName: string;
    databaseUser: string;
    databasePassword: string;
    settings?: ISetting,
    createdBy?: IUser['_id'];
    updatedBy?: IUser['_id'];
}

const TenantSchema :Schema = new Schema(
    {
        name: { type: String, required: true },
        subdomain: { type: String, required: true, unique: true },
        databaseName: { type: String, required: true },
        databaseUser: { type: String, required: true },
        databasePassword: { type: String, required: true },
        settings: { type: Schema.Types.ObjectId, ref: 'Setting' },
        createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
    },
    {
        timestamps: true,
        versionKey: false
    }
);


export default model<ITenant>("Tenant", TenantSchema);