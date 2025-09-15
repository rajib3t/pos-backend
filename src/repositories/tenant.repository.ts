import { Model } from "mongoose";
import Tenant, { ITenant,  } from "../models/tenant.model";
import { PaginatedResult, PaginationOptions, Repository, QueryOptions } from "./repository";
import BaseRepository from "./base.repository";
export class TenantRepository extends BaseRepository<ITenant> {

    private tenantModel: Model<ITenant>;


    constructor() {
        super(Tenant);
        this.tenantModel = Tenant;
    }


    


    async findTenant(conditions: { [key: string]: any }, options?: QueryOptions): Promise<ITenant | null> {
        try {
            return this.findOne(conditions, options);
        } catch (error) {
            throw new Error("Tenant find error: " + (error as Error).message);
        }
    }


    async findBySubdomain(subdomain: string, options?: QueryOptions): Promise<ITenant | null> {
        try {
            return this.findOne({ subdomain }, options);
        } catch (error) {
            throw new Error("Tenant findBySubdomain error: " + (error as Error).message);
        }
    }


   


}