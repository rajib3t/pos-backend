import { Request, Response, NextFunction } from "express";

import { Controller } from "../controller";
import TenantService from "../../services/tenant.service";
import { responseResult } from "../../utils/response";
import { errorResponse } from "../../utils/errorResponse";
import SettingService from "../../services/setting.service";
import Logging from "../../libraries/logging.library";
import ValidateMiddleware from "../../middlewares/validate";
import { tenantSettingSchema } from "../../validators/tenant.validator";
import CacheMiddleware from "../../middlewares/cache.middleware";
import CacheService from "../../services/cache.service";
import EventEmissionMiddleware from "../../middlewares/eventEmission.middleware";
import EventService from "../../events/EventService";
import DataSanitizer from "../../utils/sanitizeData";
import StoreService from "../../services/store/store.service";

class SettingController extends Controller {
    private tenantService: TenantService;
    private settingService: SettingService;
    private storeService : StoreService
    constructor() {
        super();
        this.tenantService =  TenantService.getInstance();
        this.settingService = SettingService.getInstance();
        this.storeService = StoreService.getInstance()
        this.initializeRoutes();
    }

    private initializeRoutes() {
        // Get settings with caching and rate limiting
        this.router.get(
            "/settings/:storeID", 
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                maxRequests: 100,
                keyGenerator: (req) => `settings:get:${req.params.subdomain}:${req.ip}`
            }),
            CacheMiddleware.cache({
                ttl: 600, // 10 minutes
                prefix: 'settings',
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req?.subdomain || 'unknown';
                    return `detail:${req.subdomain}:${req.params.storeID}:${context}`;
                }
            }),
            EventEmissionMiddleware.forRead('settings'),
            this.asyncHandler(this.index.bind(this))
        );

        // Update settings with rate limiting and cache invalidation
        this.router.put(
            "/settings/:storeID", 
            ValidateMiddleware.getInstance().validate(tenantSettingSchema),
            CacheMiddleware.rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutes
                maxRequests: 20,
                keyGenerator: (req) => `settings:update:${req.params.subdomain}:${req.ip}`
            }),
            CacheMiddleware.invalidate((req) => {
                const context = req.isLandlord ? 'landlord' : req.subdomain || 'unknown';
                return [
                    `settings:detail:${req.subdomain}:${req.params.storeID}:${context}`,
                    `settings:stats:*`,
                    `tenant:detail:*` // Also invalidate tenant cache as settings affect tenant data
                ];
            }),
            EventEmissionMiddleware.forUpdate('settings'),
            this.asyncHandler(this.update.bind(this))
        );

        // Cache management endpoints
        this.router.post(
            "/cache/clear",
            CacheMiddleware.rateLimit({
                windowMs: 60 * 60 * 1000, // 1 hour
                maxRequests: 10,
                keyGenerator: (req) => `settings:cache:clear:${req.ip}`
            }),
            this.asyncHandler(this.clearCache)
        );

        this.router.get(
            "/cache/stats",
            CacheMiddleware.rateLimit({
                windowMs: 60 * 1000, // 1 minute
                maxRequests: 30,
                keyGenerator: (req) => `settings:cache:stats:${req.ip}`
            }),
            this.asyncHandler(this.getCacheStats)
        );

        // Settings statistics endpoint
        this.router.get(
            "/stats",
            CacheMiddleware.cache({
                ttl: 300, // 5 minutes
                prefix: 'settings',
                keyGenerator: (req) => {
                    const context = req.isLandlord ? 'landlord' : req.tenant?.subdomain || 'unknown';
                    return `stats:${context}`;
                }
            }),
            this.asyncHandler(this.getSettingsStats)
        );
    }
    /**
         * Validate tenant context exists (but allow landlord requests)
         */
        private validateTenantContext(req: Request): void {
            if (!req.tenantConnection) {
                throw new Error('Database connection is required');
            }
        }
    
        /**
         * Get context info for logging
         */
        private getContextInfo(req: Request): string {
            if (req.isLandlord) {
                return 'landlord (main database)';
            }
            return `tenant ${req.tenant?.subdomain}`;
        }

    private async index(req: Request, res: Response) {
        
        
       
        const storeID = req.params.storeID as string;
       

        try {
           this.validateTenantContext(req);
            const store = await this.storeService.findById(req.tenantConnection!, storeID)
         
                // Tenant request - use tenant database
            const    settings = await this.settingService.findSettingTenantById(req.tenantConnection!, storeID);
            let responseData;
            if(settings){
            
                responseData = {
                    shopName: settings?.shopName ,
                    code:settings?.code,
                    address1: settings?.address,
                    address2: settings?.address2,
                    city: settings?.city,
                    state: settings?.state,
                    country: settings?.country,
                    zipCode: settings?.zipCode,
                    currency: settings?.currency,
                    phone: settings?.phone,
                    email: settings?.email,
                    logoUrl: settings?.logoUrl,
                    fassi : settings?.fassi,
                    gstNumber : settings?.gstNumber,
                    sgst : settings?.sgst,
                    cgst : settings?.cgst,
                }
            }else{
                responseData = {
                    shopName: store?.name ,
                    code:store?.code,
                }
            }

            // Emit settings viewed event
            EventService.emitAuditTrail(
                'settings_viewed',
                'settings',
                settings?._id as string,
                req.userId || 'anonymous',
                {
                    context: this.getContextInfo(req),
                    tenantSubdomain: req.tenant?.subdomain,
                    hasSettings: !!settings,
                    settingsFields: settings ? Object.keys(settings.toObject ? settings.toObject() : settings) : []
                },
                EventService.createContextFromRequest(req)
            );

            return responseResult.sendResponse({
                res,
                statusCode: 200,
                message: "Settings retrieved successfully",
                data: responseData
            });
        } catch (error) {
            return errorResponse.sendError({
                res,
                statusCode: 500,
                message: "Error retrieving settings"
            });
        }
    }


    private update = async (req: Request, res: Response) => {
        this.validateTenantContext(req);
        const storeID = req.params.storeID as string;
        const settingData = req.body
        
        
       
        
       

        try {
           
            

            const updatedSetting = await this.settingService.findSettingTenantById(req.tenantConnection!, storeID);
             
            
            let settings;
            let isCreate = false;
            let previousData = null;
            
            if(!updatedSetting){
                // Creating new settings

                isCreate = true;
                settings = await this.settingService.createSetting(req.tenantConnection!, {...settingData, store:storeID} );
                console.log(settings);
                
                // Emit settings created events
                EventService.emitAuditTrail(
                    'settings_created',
                    'settings',
                    settings._id as string,
                    req.userId || 'system',
                    {
                        context: this.getContextInfo(req),
                        tenantSubdomain: req.tenant?.subdomain,
                        settingsData: DataSanitizer.sanitizeData(settings, ['__v']),
                        createdFields: Object.keys(req.body)
                    },
                    EventService.createContextFromRequest(req)
                );

                // Emit CRUD operation event
                EventService.emitCrudOperation({
                    operation: 'create',
                    resource: 'settings',
                    resourceId: settings._id as string,
                    userId: req.userId || 'system',
                    settingsID: settings._id as string,
                    data: DataSanitizer.sanitizeData(settings, ['__v'])
                }, EventService.createContextFromRequest(req));
            }else{
                // Updating existing settings
                previousData = updatedSetting.toObject ? updatedSetting.toObject() : updatedSetting;
                settings = await this.settingService.updateSetting(req.tenantConnection!, updatedSetting?._id as string, settingData);
                
                // Emit settings updated events
                EventService.emitAuditTrail(
                    'settings_updated',
                    'settings',
                    settings?._id as string,
                    req.userId || 'system',
                    {
                        context: this.getContextInfo(req),
                        tenantSubdomain: req.tenant?.subdomain,
                        previousData: DataSanitizer.sanitizeData(previousData, ['__v']),
                        newData: settings ? DataSanitizer.sanitizeData(settings, ['__v']) : null,
                        updatedFields: Object.keys(req.body)
                    },
                    EventService.createContextFromRequest(req)
                );

                // Emit CRUD operation event
                EventService.emitCrudOperation({
                    operation: 'update',
                    resource: 'settings',
                    resourceId: settings?._id as string,
                    userId: req.userId || 'system',
                    settingID: settings?._id as string,
                    data: settings ? DataSanitizer.sanitizeData(settings, ['__v']) : null,
                    previousData: DataSanitizer.sanitizeData(previousData, ['__v'])
                }, EventService.createContextFromRequest(req));
            }

            // Emit tenant settings change event (affects tenant configuration)
            EventService.emitCustomEvent('tenant.settings.changed', {
                settingID: settings?._id,
                tenantSubdomain: req.tenant?.subdomain,
                operation: isCreate ? 'created' : 'updated',
                settingsId: settings?._id,
                changedBy: req.userId || 'system'
            }, EventService.createContextFromRequest(req));

            return responseResult.sendResponse({
                res,
                statusCode: 200,
                message: `Settings ${isCreate ? 'created' : 'updated'} successfully`,
                data: settings ? DataSanitizer.sanitizeData(settings, ['__v']) : null
            });
        } catch (error) {
            Logging.error(`Error updating settings in ${this.getContextInfo(req)}: ${error}`);
            return errorResponse.sendError({
                res,
                statusCode: 500,
                message: "Error updating settings"
            });
        }
        }

    // Cache management methods
    private clearCache = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { patterns } = (req.body || {}) as { patterns?: string[] | string };
            let totalCleared = 0;
            
            if (!patterns) {
                totalCleared = await CacheService.clear();
            } else if (Array.isArray(patterns)) {
                for (const p of patterns) {
                    totalCleared += await CacheService.clear(p);
                }
            } else {
                totalCleared = await CacheService.clear(patterns);
            }

            // Emit cache clear event
            EventService.emitAuditTrail(
                'settings_cache_cleared',
                'cache',
                'settings_cache',
                req.userId || 'system',
                {
                    context: this.getContextInfo(req),
                    patterns: patterns || 'all',
                    clearedCount: totalCleared
                },
                EventService.createContextFromRequest(req)
            );

            return responseResult.sendResponse({
                res,
                data: { cleared: totalCleared },
                message: `Settings cache cleared (${totalCleared} keys)`,
                statusCode: 200
            });
        } catch (error) {
            return errorResponse.sendError({
                res,
                message: 'Failed to clear settings cache',
                statusCode: 500,
                details: error
            });
        }
    }

    private getCacheStats = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const stats = CacheService.getStats();
            const health = await CacheService.healthCheck();
            
            return responseResult.sendResponse({
                res,
                data: { stats, health },
                message: 'Settings cache stats retrieved',
                statusCode: 200
            });
        } catch (error) {
            return errorResponse.sendError({
                res,
                message: 'Failed to get settings cache stats',
                statusCode: 500,
                details: error
            });
        }
    }

    private getSettingsStats = async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Get basic settings statistics
            const context = this.getContextInfo(req);
            
            // For now, return basic stats - you can expand this based on your needs
            const stats = {
                context,
                isLandlord: req.isLandlord,
                tenantSubdomain: req.tenant?.subdomain || null,
                timestamp: new Date().toISOString(),
                cacheEnabled: true,
                eventsEnabled: true,
                supportedOperations: ['get', 'update', 'create']
            };

            // Emit stats access event
            EventService.emitAuditTrail(
                'settings_stats_accessed',
                'settings_stats',
                'system',
                req.userId || 'anonymous',
                {
                    context,
                    stats
                },
                EventService.createContextFromRequest(req)
            );

            return responseResult.sendResponse({
                res,
                data: stats,
                message: 'Settings statistics retrieved successfully',
                statusCode: 200
            });
        } catch (error) {
            return errorResponse.sendError({
                res,
                message: 'Failed to get settings statistics',
                statusCode: 500,
                details: error
            });
        }
    }
}

export default new SettingController().router;