import { Model } from "mongoose";
import Tenant, { ITenant,  } from "../models/tenant.model";
export class TenantRepository {
    private tenantModel: Model<ITenant>;


    constructor() {
        this.tenantModel = Tenant;
    }


    async create(tenantData: Partial<ITenant>): Promise<ITenant> {
        try {
            return this.tenantModel.create(tenantData);
        } catch (error) {

            throw new Error("Tenant create error: " + (error as Error).message);

        }
        
    }

    async update(id:string, tenantData: Partial<ITenant>): Promise<ITenant | null> {

        try {
            return this.tenantModel.findByIdAndUpdate(id, tenantData, { new: true }).exec();
        } catch (error) {
            throw new Error("Tenant update error: " + (error as Error).message);
        }
    }

    async findById(id: string): Promise<ITenant | null> {
        try {
            return this.tenantModel.findById(id).exec();
        } catch (error) {
            throw new Error("Tenant findById error: " + (error as Error).message);
        }
    }

    async findAll(): Promise<ITenant[]> {
        try {
            return this.tenantModel.find().exec();
        } catch (error) {
            throw new Error("Tenant findAll error: " + (error as Error).message);
        }
    }

    async delete(id: string): Promise<ITenant | null> {
        try {
            return this.tenantModel.findByIdAndDelete(id).exec();
        } catch (error) {
            throw new Error("Tenant delete error: " + (error as Error).message);
        }
    }



}