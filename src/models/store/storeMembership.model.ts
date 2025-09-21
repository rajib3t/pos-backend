import { Schema, model, Document } from "mongoose";
import { IUser } from "../user.model";
import { IStore } from '../store/store.model';

export interface IStoreMembership extends Document {
    user: IUser['_id'];
    store: IStore['_id'];
    role: 'staff' | 'admin' | 'manager';
    status: 'active' | 'inactive' | 'pending';
    joinedAt: Date;
    leftAt?: Date;
    invitedBy?: IUser['_id'];
    permissions?: string[];
    createdAt: Date;
    updatedAt: Date;
}

const StoreMembershipSchema: Schema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User is required'],
        index: true
    },
    store: {
        type: Schema.Types.ObjectId,
        ref: 'Store',
        required: [true, 'Store is required'],
        index: true
    },
    role: {
        type: String,
        enum: {
            values: ['staff', 'admin', 'manager', 'viewer'],
            message: 'Role must be one of: member, admin, manager, viewer'
        },
        default: 'staff',
        required: true
    },
    status: {
        type: String,
        enum: {
            values: ['active', 'inactive', 'pending'],
            message: 'Status must be one of: active, inactive, pending'
        },
        default: 'pending',
        required: true
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    leftAt: {
        type: Date,
        validate: {
            validator: function(this: IStoreMembership, value: Date) {
                return !value || value > this.joinedAt;
            },
            message: 'Left date must be after joined date'
        }
    },
    invitedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    permissions: [{
        type: String,
        trim: true
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound unique index to prevent duplicate memberships
StoreMembershipSchema.index(
    { user: 1, store: 1 },
    { 
        unique: true,
        name: 'unique_user_store_membership'
    }
);

// Additional useful indexes
StoreMembershipSchema.index({ store: 1, status: 1 }); // Find active members of a store
StoreMembershipSchema.index({ user: 1, status: 1 });  // Find user's active memberships
StoreMembershipSchema.index({ role: 1, status: 1 });  // Find by role and status
StoreMembershipSchema.index({ joinedAt: -1 });        // Sort by join date
StoreMembershipSchema.index({ leftAt: 1 }, { sparse: true }); // Sparse index for leftAt

// Virtual for checking if membership is currently active
StoreMembershipSchema.virtual('isActive').get(function() {
    return this.status === 'active' && (!this.leftAt || this.leftAt > new Date());
});

// Virtual for membership duration
StoreMembershipSchema.virtual('membershipDuration').get(function() {
    const endDate: Date = this.leftAt instanceof Date ? this.leftAt : new Date();
    const joinedAt: Date = this.joinedAt instanceof Date ? this.joinedAt : new Date();
    return Math.floor((endDate.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24)); // days
});

// Pre-save middleware
StoreMembershipSchema.pre('save', function(next) {
    // Auto-set joinedAt when status changes to active for the first time
    if (this.isModified('status') && this.status === 'active' && !this.joinedAt) {
        this.joinedAt = new Date();
    }
    
    // Set leftAt when status changes to inactive
    if (this.isModified('status') && this.status === 'inactive' && !this.leftAt) {
        this.leftAt = new Date();
    }
    
    // Clear leftAt if status becomes active again
    if (this.isModified('status') && this.status === 'active' && this.leftAt) {
        this.leftAt = undefined;
    }
    
    next();
});

// Instance Methods
StoreMembershipSchema.methods.activate = function() {
    this.status = 'active';
    this.leftAt = undefined;
    return this.save();
};

StoreMembershipSchema.methods.deactivate = function() {
    this.status = 'inactive';
    this.leftAt = new Date();
    return this.save();
};

StoreMembershipSchema.methods.promoteToRole = function(newRole: string) {
    if (!['member', 'admin', 'manager', 'viewer'].includes(newRole)) {
        throw new Error('Invalid role');
    }
    this.role = newRole;
    return this.save();
};

StoreMembershipSchema.methods.addPermission = function(permission: string) {
    if (!this.permissions) this.permissions = [];
    if (!this.permissions.includes(permission)) {
        this.permissions.push(permission);
        return this.save();
    }
    return Promise.resolve(this);
};

StoreMembershipSchema.methods.removePermission = function(permission: string) {
    if (this.permissions) {
        this.permissions = this.permissions.filter((p: string) => p !== permission);
        return this.save();
    }
    return Promise.resolve(this);
};

StoreMembershipSchema.methods.hasPermission = function(permission: string) {
    return this.permissions && this.permissions.includes(permission);
};

// Static Methods
StoreMembershipSchema.statics.findByStore = function(storeId: string, status?: string) {
    const query: any = { store: storeId };
    if (status) query.status = status;
    return this.find(query).populate('user', 'name email');
};

StoreMembershipSchema.statics.findByUser = function(userId: string, status?: string) {
    const query: any = { user: userId };
    if (status) query.status = status;
    return this.find(query).populate('store', 'name code');
};

StoreMembershipSchema.statics.findActiveMemberships = function() {
    return this.find({ 
        status: 'active',
        $or: [
            { leftAt: { $exists: false } },
            { leftAt: { $gt: new Date() } }
        ]
    });
};

StoreMembershipSchema.statics.getStoreAdmins = function(storeId: string) {
    return this.find({ 
        store: storeId, 
        role: 'admin', 
        status: 'active' 
    }).populate('user', 'name email');
};

// Pre-remove middleware to handle cleanup
StoreMembershipSchema.pre('deleteOne', { document: true, query: false }, function(next) {
    // Add any cleanup logic here if needed
    next();
});

export default model<IStoreMembership>("StoreMembership", StoreMembershipSchema);