import { Connection } from "mongoose";
import BaseRepository from "../base.repository";
import StoreMembership, { IStoreMembership } from "../../models/store/storeMembership.model";

type MembershipRole = 'staff' | 'admin' | 'manager' | 'viewer';
type MembershipStatus = 'active' | 'inactive' | 'pending';

export default class StoreMembershipRepository extends BaseRepository<IStoreMembership> {
    constructor(connection?: Connection) {
        if (connection) {
            super(StoreMembership, 'StoreMembership', connection);
        } else {
            super(StoreMembership);
        }
    }

    async findByStore(storeId: string, status?: MembershipStatus) {
        const filter: any = { store: storeId };
        if (status) filter.status = status;
        return this.findMany(filter, {
            populate: [
                { path: 'user', select: 'name email mobile role status' },
                { path: 'store', select: 'name code status' }
            ]
        });
    }

    async findByUser(userId: string, status?: MembershipStatus) {
        const filter: any = { user: userId };
        if (status) filter.status = status;
        return this.findMany(filter, {
            populate: [
                { path: 'store', select: 'name code status' },
                { path: 'user', select: 'name email' }
            ]
        });
    }

    async findActiveMemberships() {
        return this.findMany({
            status: 'active',
            $or: [
                { leftAt: { $exists: false } },
                { leftAt: { $gt: new Date() } }
            ]
        } as any);
    }

    async getStoreAdmins(storeId: string) {
        return this.findMany({ store: storeId, role: 'admin', status: 'active' } as any, {
            populate: [{ path: 'user', select: 'name email' }]
        });
    }

    async upsertMembership(params: {
        userId: string;
        storeId: string;
        role?: MembershipRole;
        status?: MembershipStatus;
        invitedBy?: string;
        permissions?: string[];
    }) {
        const { userId, storeId, role = 'staff', status = 'pending', invitedBy, permissions } = params;
        const updated = await this.model.findOneAndUpdate(
            { user: userId as any, store: storeId as any },
            {
                $set: {
                    role,
                    status,
                    invitedBy: invitedBy as any,
                    permissions
                },
                $setOnInsert: {
                    joinedAt: status === 'active' ? new Date() : undefined
                }
            },
            { new: true, upsert: true }
        ).exec();
        return (updated && typeof (updated as any).toObject === 'function') ? (updated as any).toObject() : (updated as any);
    }

    async removeMembership(userId: string, storeId: string) {
        const membership = await this.findOne({ user: userId, store: storeId } as any, { lean: false });
        if (!membership) return null;
        return (membership as any).deleteOne();
    }

    async addPermission(membershipId: string, permission: string) {
        const membership = await this.findById(membershipId, { lean: false });
        if (!membership) return null;
        const doc: any = membership;
        if (!doc.permissions) doc.permissions = [];
        if (!doc.permissions.includes(permission)) {
            doc.permissions.push(permission);
        }
        return doc.save();
    }

    async removePermission(membershipId: string, permission: string) {
        const membership = await this.findById(membershipId, { lean: false });
        if (!membership) return null;
        const doc: any = membership;
        if (Array.isArray(doc.permissions)) {
            doc.permissions = doc.permissions.filter((p: string) => p !== permission);
        }
        return doc.save();
    }

    async activateMembership(membershipId: string) {
        const membership = await this.findById(membershipId, { lean: false });
        if (!membership) return null;
        const doc: any = membership;
        doc.status = 'active';
        doc.leftAt = undefined;
        if (!doc.joinedAt) doc.joinedAt = new Date();
        return doc.save();
    }

    async deactivateMembership(membershipId: string) {
        const membership = await this.findById(membershipId, { lean: false });
        if (!membership) return null;
        const doc: any = membership;
        doc.status = 'inactive';
        doc.leftAt = new Date();
        return doc.save();
    }

    async promoteRole(membershipId: string, newRole: MembershipRole) {
        const membership = await this.findById(membershipId, { lean: false });
        if (!membership) return null;
        const validRoles: MembershipRole[] = ['staff', 'admin', 'manager', 'viewer'];
        if (!validRoles.includes(newRole)) {
            throw new Error('Invalid role');
        }
        const doc: any = membership;
        doc.role = newRole;
        return doc.save();
    }

    async getMembersWithUsers(storeId: string, options?: {
        status?: MembershipStatus;
        role?: MembershipRole;
        page?: number;
        limit?: number;
    }) {
        const { status, role, page = 1, limit = 10 } = options || {};
        const filter: any = { store: storeId };
        if (status) filter.status = status;
        if (role) filter.role = role;

        return this.findPaginated({
            filter,
            page,
            limit,
            sort: { createdAt: -1 },
            populate: [{ path: 'user', select: 'name email mobile role status' }]
        });
    }

    async paginateMemberships(options?: {
        page?: number;
        limit?: number;
        storeId?: string;
        userId?: string;
        role?: MembershipRole;
        status?: MembershipStatus;
        joinedFrom?: string | Date;
        joinedTo?: string | Date;
        userName?: string; // dynamic filter on populated user.name/email/mobile
        storeName?: string; // dynamic filter on populated store.name/code
        sort?: Record<string, 1 | -1>;
        populateUser?: boolean;
        populateStore?: boolean;
        projection?: Record<string, 0 | 1>;
    }) {
        const {
            page = 1,
            limit = 10,
            storeId,
            userId,
            role,
            status,
            joinedFrom,
            joinedTo,
            sort = { createdAt: -1 },
            populateUser = true,
            populateStore = false,
            projection = {},
            userName,
            storeName
        } = options || {};

        const filter: any = {};
        if (storeId) filter.store = storeId;
        if (userId) filter.user = userId;
        if (role) filter.role = role;
        if (status) filter.status = status;
        if (joinedFrom || joinedTo) {
            filter.joinedAt = {} as any;
            if (joinedFrom) (filter.joinedAt as any).$gte = new Date(joinedFrom);
            if (joinedTo) (filter.joinedAt as any).$lte = new Date(joinedTo);
        }

        // If dynamic name filters are requested, use aggregation for server-side filtering on populated fields
        if (userName || storeName) {
            const pipeline: any[] = [];
            // Base match
            if (Object.keys(filter).length > 0) {
                pipeline.push({ $match: filter });
            }

            // Lookups
            pipeline.push(
                {
                    $lookup: {
                        from: 'users',
                        localField: 'user',
                        foreignField: '_id',
                        as: 'user'
                    }
                },
                { $unwind: '$user' },
                {
                    $lookup: {
                        from: 'stores',
                        localField: 'store',
                        foreignField: '_id',
                        as: 'store'
                    }
                },
                { $unwind: '$store' }
            );

            // Dynamic name filters
            const nameMatch: any = {};
            if (userName) {
                const regex = new RegExp(userName, 'i');
                nameMatch.$or = [
                    { 'user.name': regex },
                    { 'user.email': regex },
                    { 'user.mobile': regex }
                ];
            }
            if (storeName) {
                const regex = new RegExp(storeName, 'i');
                if (!nameMatch.$or) nameMatch.$or = [];
                nameMatch.$or.push({ 'store.name': regex }, { 'store.code': regex });
            }
            if (nameMatch.$or && nameMatch.$or.length > 0) {
                pipeline.push({ $match: nameMatch });
            }

            // Sorting
            if (sort && Object.keys(sort).length > 0) {
                pipeline.push({ $sort: sort });
            } else {
                pipeline.push({ $sort: { createdAt: -1 } });
            }

            // Facet for pagination
            pipeline.push({
                $facet: {
                    items: [
                        { $skip: (page - 1) * limit },
                        { $limit: limit },
                        {
                            $project: {
                                ...((projection || {}) as any),
                                user: populateUser ? {
                                    name: 1,
                                    email: 1,
                                    mobile: 1,
                                    role: 1,
                                    status: 1,
                                    _id: 1
                                } : 0,
                                store: populateStore ? {
                                    name: 1,
                                    code: 1,
                                    status: 1,
                                    _id: 1
                                } : 0
                            }
                        }
                    ],
                    total: [ { $count: 'count' } ]
                }
            });

            const aggResult = await (this.model as any).aggregate(pipeline).exec();
            const facet = (aggResult && aggResult[0]) || { items: [], total: [] };
            const items = facet.items || [];
            const total = (facet.total && facet.total[0] && facet.total[0].count) || 0;
            return {
                items,
                total,
                page,
                limit,
                pages: Math.ceil(total / limit)
            };
        }

        // Default path using base pagination with optional populates
        const populate: any[] = [];
        if (populateUser) populate.push({ path: 'user', select: 'name email mobile role status' });
        if (populateStore) populate.push({ path: 'store', select: 'name code status' });

        return this.findPaginated({
            filter,
            page,
            limit,
            sort,
            projection,
            populate
        });
    }
}