import { Model } from "mongoose";
import Tenant, { ITenant,  } from "../models/tenant.model";
import { PaginatedResult, PaginationOptions, Repository } from "./repository";
import BaseRepository from "./base.repository";
export class TenantRepository extends BaseRepository<ITenant> {

    private tenantModel: Model<ITenant>;


    constructor() {
        super(Tenant);
        this.tenantModel = Tenant;
    }


    


    async findTenant(conditions: { [key: string]: any }): Promise<ITenant | null> {
        try {
            return this.tenantModel.findOne(conditions).exec();
        } catch (error) {
            throw new Error("Tenant find error: " + (error as Error).message);
        }
    }


    async findBySubdomain(subdomain: string): Promise<ITenant | null> {
        try {
            return this.tenantModel.findOne({ subdomain }).exec();
        } catch (error) {
            throw new Error("Tenant findBySubdomain error: " + (error as Error).message);
        }
    }


   


}