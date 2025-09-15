/**
 * Example usage of tenant service with enhanced populate and filtering capabilities
 * This file demonstrates the new flexible populate and filtering options
 */

import TenantService from '../services/tenant.service';
import { ITenant } from '../models/tenant.model';
import { PaginationOptions, QueryOptions } from '../repositories/repository';

const tenantService = TenantService.getInstance();

export class TenantAdvancedExamples {
    
    /**
     * Example: Basic pagination with automatic populate
     */
    static async getBasicPaginatedTenants() {
        try {
            // Automatic population of createdBy, updatedBy, and settings
            const result = await tenantService.getTenantsWithPagination({
                page: 1,
                limit: 10,
                sort: { createdAt: -1 }
            });

            console.log('Basic Paginated Tenants (Auto-populate):');
            console.log(`Total: ${result.total}, Pages: ${result.pages}`);
            result.items.forEach(tenant => {
                console.log(`- ${tenant.name} (Created by: ${(tenant.createdBy as any)?.name || 'Unknown'})`);
            });

            return result;
        } catch (error) {
            console.error('Error:', error);
        }
    }

    /**
     * Example: Pagination with custom populate options
     */
    static async getCustomPopulateTenants() {
        try {
            const result = await tenantService.getTenantsWithPagination({
                page: 1,
                limit: 5,
                filter: {
                    name: { $regex: 'company', $options: 'i' }
                },
                populate: [
                    { path: 'createdBy', select: 'name email mobile' }, // Include more fields
                    { path: 'updatedBy', select: 'name email' },
                    { 
                        path: 'settings', 
                        populate: { 
                            path: 'category', 
                            select: 'name' 
                        } 
                    } // Nested populate
                ]
            });

            console.log('Custom Populate Tenants:');
            result.items.forEach(tenant => {
                console.log(`- ${tenant.name}`);
                console.log(`  Created by: ${(tenant.createdBy as any)?.name} (${(tenant.createdBy as any)?.email})`);
                if ((tenant.createdBy as any)?.mobile) {
                    console.log(`  Mobile: ${(tenant.createdBy as any).mobile}`);
                }
            });

            return result;
        } catch (error) {
            console.error('Error:', error);
        }
    }

    /**
     * Example: Pagination with no populate (faster performance)
     */
    static async getFastPaginatedTenants() {
        try {
            const result = await tenantService.getTenantsWithPagination({
                page: 1,
                limit: 20,
                sort: { name: 1 },
                populate: [] // No populate for better performance
            });

            console.log('Fast Paginated Tenants (No populate):');
            console.log(`Total: ${result.total}, Pages: ${result.pages}`);
            result.items.forEach(tenant => {
                console.log(`- ${tenant.name} (${tenant.subdomain})`);
                console.log(`  CreatedBy ID: ${tenant.createdBy}, UpdatedBy ID: ${tenant.updatedBy}`);
            });

            return result;
        } catch (error) {
            console.error('Error:', error);
        }
    }

    /**
     * Example: Advanced filtering with populate
     */
    static async getAdvancedFilteredTenants() {
        try {
            const fromDate = new Date('2025-01-01');
            const toDate = new Date('2025-12-31');

            const result = await tenantService.getTenantsWithAdvancedPagination(
                {
                    // Advanced filtering
                    name: { $regex: 'tech|corp', $options: 'i' }, // Contains 'tech' or 'corp'
                    createdAt: {
                        $gte: fromDate,
                        $lte: toDate
                    },
                    // Filter by populated field (requires aggregation in real implementation)
                    subdomain: { $exists: true, $ne: '' }
                },
                1, // page
                10, // limit
                { createdAt: -1, name: 1 }, // sort
                [
                    { path: 'createdBy', select: 'name email' },
                    { path: 'updatedBy', select: 'name email' }
                ] // populate
            );

            console.log('Advanced Filtered Tenants:');
            console.log(`Found ${result.total} tenants matching criteria`);
            result.items.forEach(tenant => {
                console.log(`- ${tenant.name} (${tenant.subdomain})`);
                console.log(`  Created by: ${(tenant.createdBy as any)?.name}`);
            });

            return result;
        } catch (error) {
            console.error('Error:', error);
        }
    }

    /**
     * Example: Single tenant with optional relations
     */
    static async getSingleTenantFlexible(tenantId: string, withRelations: boolean = true) {
        try {
            let tenant: ITenant | null;

            if (withRelations) {
                tenant = await tenantService.findByIdWithRelations(tenantId);
            } else {
                tenant = await tenantService.findById(tenantId);
            }

            if (tenant) {
                console.log('Single Tenant:');
                console.log(`Name: ${tenant.name}`);
                console.log(`Subdomain: ${tenant.subdomain}`);
                
                if (withRelations) {
                    console.log(`Created by: ${(tenant.createdBy as any)?.name || 'Unknown'}`);
                    console.log(`Updated by: ${(tenant.updatedBy as any)?.name || 'Unknown'}`);
                } else {
                    console.log(`Created by ID: ${tenant.createdBy}`);
                    console.log(`Updated by ID: ${tenant.updatedBy}`);
                }
            }

            return tenant;
        } catch (error) {
            console.error('Error:', error);
        }
    }

    /**
     * Example: All tenants with optional relations
     */
    static async getAllTenantsFlexible(withRelations: boolean = false) {
        try {
            let tenants: ITenant[];

            if (withRelations) {
                tenants = await tenantService.findAllWithRelations();
            } else {
                tenants = await tenantService.findAll();
            }

            console.log(`All Tenants (Relations: ${withRelations ? 'Yes' : 'No'}):`);
            tenants.forEach(tenant => {
                console.log(`- ${tenant.name}`);
                if (withRelations && tenant.createdBy) {
                    console.log(`  Created by: ${(tenant.createdBy as any)?.name}`);
                }
            });

            return tenants;
        } catch (error) {
            console.error('Error:', error);
        }
    }

    /**
     * Example: Tenant by subdomain with optional relations
     */
    static async getTenantBySubdomainFlexible(subdomain: string, withRelations: boolean = true) {
        try {
            const tenant = await tenantService.getTenantBySubdomain(subdomain, withRelations);

            if (tenant) {
                console.log(`Tenant by Subdomain (${subdomain}):`);
                console.log(`Name: ${tenant.name}`);
                console.log(`Status: Active`);
                
                if (withRelations && tenant.createdBy) {
                    console.log(`Created by: ${(tenant.createdBy as any)?.name} (${(tenant.createdBy as any)?.email})`);
                }
                
                if (withRelations && tenant.settings) {
                    console.log(`Settings: Available`);
                }
            } else {
                console.log(`No tenant found with subdomain: ${subdomain}`);
            }

            return tenant;
        } catch (error) {
            console.error('Error:', error);
        }
    }

    /**
     * Example: Complex filtering with text search and date ranges
     */
    static async getComplexFilteredTenants() {
        try {
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);

            const result = await tenantService.getTenantsWithPagination({
                page: 1,
                limit: 15,
                filter: {
                    // Text search across multiple fields
                    $or: [
                        { name: { $regex: 'enterprise|business|corp', $options: 'i' } },
                        { subdomain: { $regex: 'pro|enterprise', $options: 'i' } }
                    ],
                    // Date filter
                    createdAt: { $gte: lastMonth },
                    // Exclude specific subdomains
                    subdomain: { $nin: ['test', 'demo', 'staging'] }
                },
                sort: { createdAt: -1 },
                populate: [
                    { path: 'createdBy', select: 'name email' },
                    { path: 'settings', select: 'theme language timezone' }
                ]
            });

            console.log('Complex Filtered Tenants:');
            console.log(`${result.total} tenants found with complex criteria`);
            result.items.forEach(tenant => {
                console.log(`- ${tenant.name} (${tenant.subdomain})`);
                console.log(`  Created by: ${(tenant.createdBy as any)?.name}`);
                console.log(`  Created by: ${(tenant.createdBy as any)?.name}`);
            });

            return result;
        } catch (error) {
            console.error('Error:', error);
        }
    }
}

// Usage examples (uncomment to test):
/*
async function runAdvancedExamples() {
    console.log('=== Basic Pagination ===');
    await TenantAdvancedExamples.getBasicPaginatedTenants();
    
    console.log('\n=== Custom Populate ===');
    await TenantAdvancedExamples.getCustomPopulateTenants();
    
    console.log('\n=== Fast Pagination (No populate) ===');
    await TenantAdvancedExamples.getFastPaginatedTenants();
    
    console.log('\n=== Advanced Filtering ===');
    await TenantAdvancedExamples.getAdvancedFilteredTenants();
    
    console.log('\n=== Single Tenant (with relations) ===');
    await TenantAdvancedExamples.getSingleTenantFlexible('tenant-id', true);
    
    console.log('\n=== Single Tenant (no relations) ===');
    await TenantAdvancedExamples.getSingleTenantFlexible('tenant-id', false);
    
    console.log('\n=== All Tenants (with relations) ===');
    await TenantAdvancedExamples.getAllTenantsFlexible(true);
    
    console.log('\n=== Tenant by Subdomain ===');
    await TenantAdvancedExamples.getTenantBySubdomainFlexible('example-subdomain');
    
    console.log('\n=== Complex Filtering ===');
    await TenantAdvancedExamples.getComplexFilteredTenants();
}

runAdvancedExamples().catch(console.error);
*/