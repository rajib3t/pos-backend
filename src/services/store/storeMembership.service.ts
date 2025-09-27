import { Connection } from "mongoose";
import StoreMembershipRepository from "../../repositories/store/storeMembership.repository";
import { IStoreMembership } from "../../models/store/storeMembership.model";
import { PaginatedResult, QueryOptions } from '../../repositories/repository';
import Logging from "../../libraries/logging.library";

class StoreMembershipService {
    private static instance: StoreMembershipService;
    private repository: StoreMembershipRepository;
    
    private constructor() {
        this.repository = new StoreMembershipRepository();
    }

    public static getInstance(): StoreMembershipService {
        if (!StoreMembershipService.instance) {
            StoreMembershipService.instance = new StoreMembershipService();
        }
        return StoreMembershipService.instance;
    }

    public async upsertMembership(params: {
        userId: string;
        storeId: string;
        role?: 'staff' | 'admin' | 'manager' | 'viewer';
        status?: 'active' | 'inactive' | 'pending';
        invitedBy?: string;
        permissions?: string[];
    }): Promise<IStoreMembership>;
    public async upsertMembership(connection: Connection, params: {
        userId: string;
        storeId: string;
        role?: 'staff' | 'admin' | 'manager' | 'viewer';
        status?: 'active' | 'inactive' | 'pending';
        invitedBy?: string;
        permissions?: string[];
    }): Promise<IStoreMembership>;
    public async upsertMembership(connectionOrParams: Connection | any, paramsArg?: any): Promise<IStoreMembership> {
        if (connectionOrParams instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrParams);
            return await repo.upsertMembership(paramsArg);
        }
        return await this.repository.upsertMembership(connectionOrParams);
    }

    /**
     * Add a staff membership to a store for a user. This is a convenience wrapper
     * around upsertMembership that defaults the role to 'staff' and status to 'pending'.
     */
    public async addStaff(params: {
        userId: string;
        storeId: string;
        role?: 'staff' | 'admin' | 'manager' | 'viewer';
        status?: 'active' | 'inactive' | 'pending';
        invitedBy?: string;
        permissions?: string[];
    }): Promise<IStoreMembership>;
    public async addStaff(connection: Connection, params: {
        userId: string;
        storeId: string;
        role?: 'staff' | 'admin' | 'manager' | 'viewer';
        status?: 'active' | 'inactive' | 'pending';
        invitedBy?: string;
        permissions?: string[];
    }): Promise<IStoreMembership>;
    public async addStaff(connectionOrParams: Connection | any, paramsArg?: any): Promise<IStoreMembership> {
        if (connectionOrParams instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrParams);
            const params = {
                ...paramsArg,
                role: paramsArg?.role || 'staff',
                status: paramsArg?.status || 'pending'
            };
            return await repo.upsertMembership(params);
        }
        const params = {
            ...connectionOrParams,
            role: connectionOrParams?.role || 'staff',
            status: connectionOrParams?.status || 'pending'
        };
        return await this.repository.upsertMembership(params);
    }

    public async findById(id: string, options?: QueryOptions): Promise<IStoreMembership | null>;
    public async findById(connection: Connection, id: string, options?: QueryOptions): Promise<IStoreMembership | null>;
    public async findById(connectionOrId: string | Connection, idOrOptions?: string | QueryOptions, options?: QueryOptions): Promise<IStoreMembership | null> {
        if (connectionOrId instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrId);
            return await repo.findById(idOrOptions as string, options);
        }
        return await this.repository.findById(connectionOrId, idOrOptions as QueryOptions | undefined);
    }

    public async update(id: string, data: Partial<IStoreMembership>): Promise<IStoreMembership | null>;
    public async update(connection: Connection, id: string, data: Partial<IStoreMembership>): Promise<IStoreMembership | null>;
    public async update(connectionOrId: Connection | string, idOrData: string | Partial<IStoreMembership>, dataArg?: Partial<IStoreMembership>): Promise<IStoreMembership | null> {
        if (connectionOrId instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrId);
            return await repo.update(idOrData as string, dataArg!);
        }
        return await this.repository.update(connectionOrId, idOrData as Partial<IStoreMembership>);
    }

    public async delete(id: string): Promise<IStoreMembership | null>;
    public async delete(connection: Connection, id: string): Promise<IStoreMembership | null>;
    public async delete(connectionOrId: Connection | string, id?: string): Promise<IStoreMembership | null> {
        if (connectionOrId instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrId);
            const result = await repo.delete(id!);
            return (result && (result as any).deletedCount !== undefined) ? null : (result as IStoreMembership | null);
        }
        const result = await this.repository.delete(connectionOrId);
        return (result && (result as any).deletedCount !== undefined) ? null : (result as IStoreMembership | null);
    }

    public async removeMembership(userId: string, storeId: string): Promise<any>;
    public async removeMembership(connection: Connection, userId: string, storeId: string): Promise<any>;
    public async removeMembership(connectionOrUserId: Connection | string, userIdOrStoreId: string, storeIdArg?: string): Promise<any> {
        if (connectionOrUserId instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrUserId);
            return await repo.removeMembership(userIdOrStoreId, storeIdArg!);
        }
        return await this.repository.removeMembership(connectionOrUserId, userIdOrStoreId);
    }

    public async findByStore(storeId: string, status?: IStoreMembership['status']): Promise<IStoreMembership[]>;
    public async findByStore(connection: Connection, storeId: string, status?: IStoreMembership['status']): Promise<IStoreMembership[]>;
    public async findByStore(connectionOrStoreId: Connection | string, storeIdOrStatus?: string | IStoreMembership['status'], statusArg?: IStoreMembership['status']): Promise<IStoreMembership[]> {
        if (connectionOrStoreId instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrStoreId);
            return await repo.findByStore(storeIdOrStatus as string, statusArg as any);
        }
        return await this.repository.findByStore(connectionOrStoreId, storeIdOrStatus as any);
    }

    public async findByUser(userId: string, status?: IStoreMembership['status']): Promise<IStoreMembership[]>;
    public async findByUser(connection: Connection, userId: string, status?: IStoreMembership['status']): Promise<IStoreMembership[]>;
    public async findByUser(connectionOrUserId: Connection | string, userIdOrStatus?: string | IStoreMembership['status'], statusArg?: IStoreMembership['status']): Promise<IStoreMembership[]> {
        if (connectionOrUserId instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrUserId);
            return await repo.findByUser(userIdOrStatus as string, statusArg as any);
        }
        return await this.repository.findByUser(connectionOrUserId, userIdOrStatus as any);
    }

    public async getStoreAdmins(storeId: string): Promise<IStoreMembership[]>;
    public async getStoreAdmins(connection: Connection, storeId: string): Promise<IStoreMembership[]>;
    public async getStoreAdmins(connectionOrStoreId: Connection | string, storeIdArg?: string): Promise<IStoreMembership[]> {
        if (connectionOrStoreId instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrStoreId);
            return await repo.getStoreAdmins(storeIdArg!);
        }
        return await this.repository.getStoreAdmins(connectionOrStoreId);
    }

    public async findActiveMemberships(): Promise<IStoreMembership[]>;
    public async findActiveMemberships(connection: Connection): Promise<IStoreMembership[]>;
    public async findActiveMemberships(connectionArg?: Connection): Promise<IStoreMembership[]> {
        if (connectionArg instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionArg);
            return await repo.findActiveMemberships();
        }
        return await this.repository.findActiveMemberships();
    }

    public async paginateMemberships(options?: {
        page?: number;
        limit?: number;
        storeId?: string;
        userId?: string;
        role?: 'staff' | 'admin' | 'manager' | 'viewer';
        status?: 'active' | 'inactive' | 'pending';
        joinedFrom?: string | Date;
        joinedTo?: string | Date;
        userName?: string;
        storeName?: string;
        sort?: Record<string, 1 | -1>;
        populateUser?: boolean;
        populateStore?: boolean;
        projection?: Record<string, 0 | 1>;
    }): Promise<PaginatedResult<IStoreMembership>>;
    public async paginateMemberships(connection: Connection, options?: {
        page?: number;
        limit?: number;
        storeId?: string;
        userId?: string;
        role?: 'staff' | 'admin' | 'manager' | 'viewer';
        status?: 'active' | 'inactive' | 'pending';
        joinedFrom?: string | Date;
        joinedTo?: string | Date;
        userName?: string;
        storeName?: string;
        sort?: Record<string, 1 | -1>;
        populateUser?: boolean;
        populateStore?: boolean;
        projection?: Record<string, 0 | 1>;
    }): Promise<PaginatedResult<IStoreMembership>>;
    public async paginateMemberships(connectionOrOptions?: Connection | any, optionsArg?: any): Promise<PaginatedResult<IStoreMembership>> {
        if (connectionOrOptions instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrOptions);
            return await repo.paginateMemberships(optionsArg || {});
        }
        return await this.repository.paginateMemberships(connectionOrOptions || {});
    }

    public async getMembersWithUsers(storeId: string, options?: {
        status?: 'active' | 'inactive' | 'pending';
        role?: 'staff' | 'admin' | 'manager' | 'viewer';
        page?: number;
        limit?: number;
    }): Promise<PaginatedResult<IStoreMembership>>;
    public async getMembersWithUsers(connection: Connection, storeId: string, options?: {
        status?: 'active' | 'inactive' | 'pending';
        role?: 'staff' | 'admin' | 'manager' | 'viewer';
        page?: number;
        limit?: number;
    }): Promise<PaginatedResult<IStoreMembership>>;
    public async getMembersWithUsers(connectionOrStoreId: Connection | string, storeIdOrOptions?: string | any, optionsArg?: any): Promise<PaginatedResult<IStoreMembership>> {
        if (connectionOrStoreId instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrStoreId);
            return await repo.getMembersWithUsers(storeIdOrOptions as string, optionsArg);
        }
        return await this.repository.getMembersWithUsers(connectionOrStoreId, storeIdOrOptions as any);
    }

    public async addPermission(membershipId: string, permission: string): Promise<IStoreMembership | null>;
    public async addPermission(connection: Connection, membershipId: string, permission: string): Promise<IStoreMembership | null>;
    public async addPermission(connectionOrId: Connection | string, idOrPermission: string, permissionArg?: string): Promise<IStoreMembership | null> {
        if (connectionOrId instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrId);
            return await repo.addPermission(idOrPermission, permissionArg!);
        }
        return await this.repository.addPermission(connectionOrId, idOrPermission);
    }

    public async removePermission(membershipId: string, permission: string): Promise<IStoreMembership | null>;
    public async removePermission(connection: Connection, membershipId: string, permission: string): Promise<IStoreMembership | null>;
    public async removePermission(connectionOrId: Connection | string, idOrPermission: string, permissionArg?: string): Promise<IStoreMembership | null> {
        if (connectionOrId instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrId);
            return await repo.removePermission(idOrPermission, permissionArg!);
        }
        return await this.repository.removePermission(connectionOrId, idOrPermission);
    }

    public async activateMembership(membershipId: string): Promise<IStoreMembership | null>;
    public async activateMembership(connection: Connection, membershipId: string): Promise<IStoreMembership | null>;
    public async activateMembership(connectionOrId: Connection | string, idArg?: string): Promise<IStoreMembership | null> {
        if (connectionOrId instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrId);
            return await repo.activateMembership(idArg!);
        }
        return await this.repository.activateMembership(connectionOrId);
    }

    public async deactivateMembership(membershipId: string): Promise<IStoreMembership | null>;
    public async deactivateMembership(connection: Connection, membershipId: string): Promise<IStoreMembership | null>;
    public async deactivateMembership(connectionOrId: Connection | string, idArg?: string): Promise<IStoreMembership | null> {
        if (connectionOrId instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrId);
            return await repo.deactivateMembership(idArg!);
        }
        return await this.repository.deactivateMembership(connectionOrId);
    }

    public async promoteRole(membershipId: string, newRole: 'staff' | 'admin' | 'manager' | 'viewer'): Promise<IStoreMembership | null>;
    public async promoteRole(connection: Connection, membershipId: string, newRole: 'staff' | 'admin' | 'manager' | 'viewer'): Promise<IStoreMembership | null>;
    public async promoteRole(connectionOrId: Connection | string, idOrRole: string, roleArg?: 'staff' | 'admin' | 'manager' | 'viewer'): Promise<IStoreMembership | null> {
        if (connectionOrId instanceof Connection) {
            const repo = new StoreMembershipRepository(connectionOrId);
            return await repo.promoteRole(idOrRole, roleArg!);
        }
        return await this.repository.promoteRole(connectionOrId, idOrRole as any);
    }
}

export default StoreMembershipService;
