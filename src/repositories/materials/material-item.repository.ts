import { Connection } from "mongoose";

import MaterialItem, { IMaterialItem } from "../../models/materials/material-item.model";
import { PaginatedResult, PaginationOptions } from "../repository";
import BaseRepository from "../base.repository";
import { TenantModelFactory } from "../../utils/tenantModelFactory";

export default class MaterialItemRepository extends BaseRepository<IMaterialItem> {

    private connection?: Connection;

    constructor(connection?: Connection) {
        if (connection) {
            super(MaterialItem, 'MaterialItem', connection);
            this.connection = connection;
        } else {
            // Use default master database connection
            super(MaterialItem);
        }
    }

        

    /**
     * Ensure required models are registered on tenant connection
     * This is needed for populate operations to work correctly
     */
    private ensureModelsRegistered(): void {
        if (this.connection) {
            TenantModelFactory.getUserModel(this.connection);
        }
    }

    /**
     * Override findPaginated to ensure models are registered before populate
     */
    async findPaginated(options?: PaginationOptions<IMaterialItem>): Promise<PaginatedResult<IMaterialItem>> {
        // Ensure User and MaterialCategory models are registered for populate operations
        this.ensureModelsRegistered();

        // Debug logging
        if (options?.populate) {
            console.log('MaterialItem Repository - Populate options:', JSON.stringify(options.populate, null, 2));
        }

        return super.findPaginated(options);
    }




}