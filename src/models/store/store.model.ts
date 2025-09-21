import { Schema, model, Document } from "mongoose";
import { IUser } from "../user.model";

export interface IStore extends Document {
    name: string;
    code: string;
    status: 'inactive' | 'active';
    createdBy: IUser["_id"];
    updatedBy?: IUser["_id"]; // Optional since it might not be set initially
    createdAt: Date;
    updatedAt: Date;
}

const StoreSchema: Schema = new Schema({
    name: {
        type: String,
        required: [true, 'Store name is required'],
        unique: true,
        trim: true,
        maxlength: [100, 'Store name cannot exceed 100 characters']
    },
    code: {
        type: String,
        required: [true, 'Store code is required'],
        unique: true,
        uppercase: true,
        trim: true,
        maxlength: [10, 'Store code cannot exceed 10 characters'],
        match: [/^[A-Z0-9]+$/, 'Store code can only contain uppercase letters and numbers']
    },
    status: {
        type: String,
        enum: {
            values: ['inactive', 'active'],
            message: 'Status must be either inactive or active'
        },
        default: 'active'
    },
    createdBy: { 
        type: Schema.Types.ObjectId, 
        ref: "User",
        required: [true, 'CreatedBy field is required']
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User"
    }
}, {
    timestamps: true, // Automatically adds createdAt and updatedAt
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound index for better query performance
StoreSchema.index({ name: 1, code: 1 });

// Individual indexes for common queries
StoreSchema.index({ status: 1 });
StoreSchema.index({ createdBy: 1 });

// Pre-save middleware to set updatedBy
StoreSchema.pre('save', function(next) {
    if (this.isModified() && !this.isNew) {
        // You might want to set updatedBy here if you have access to current user context
        this.updatedBy = this.updatedBy || this.createdBy;
    }
    next();
});

// Instance method to activate store
StoreSchema.methods.activate = function() {
    this.status = 'active';
    return this.save();
};

// Instance method to deactivate store
StoreSchema.methods.deactivate = function() {
    this.status = 'inactive';
    return this.save();
};

// Static method to find active stores
StoreSchema.statics.findActive = function() {
    return this.find({ status: 'active' });
};

export default model<IStore>("Store", StoreSchema);