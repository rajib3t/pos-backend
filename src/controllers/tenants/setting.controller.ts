import e, { Request, Response } from "express";

import { Controller } from "../controller";
import TenantService from "../../services/tenant.service";
import { responseResult } from "../../utils/response";
import { errorResponse } from "../../utils/errorResponse";
import SettingService from "../../services/setting.service";
import Logging from "../../libraries/logging.library";

class SettingController extends Controller {
    private tenantService: TenantService;
    private settingService: SettingService;
    constructor() {
        super();
        this.tenantService =  TenantService.getInstance();
        this.settingService = SettingService.getInstance();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get("/settings/:subdomain", this.asyncHandler(this.index.bind(this)));
        this.router.put("/settings/:subdomain", this.asyncHandler(this.update.bind(this)));
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
        this.validateTenantContext(req);
       
        const tenantId = req.params.subdomain as string;
        if (!tenantId) {
            return errorResponse.sendError({
                res,
                statusCode: 400,
                message: "Tenant subdomain header (x-tenant-subdomain) is required"
            })
        }

        try {
            const tenant = await this.tenantService.getTenantSettings(tenantId);
            
            if (!tenant) {
                return errorResponse.sendError({
                    res,
                    statusCode: 404,
                    message: "Settings not found for the tenant"
                });
            }
            let settings 
           if (req.isLandlord) {
                // Landlord request - use main database
                settings = await this.settingService.findSettingTenantById(tenant._id);
            } else {
                // Tenant request - use tenant database
                settings = await this.settingService.findSettingTenantById(req.tenantConnection!, tenant._id);
            }
            
            const responseData = {
                shopName: settings?.shopName || tenant.name,
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
        const tenantId = req.params.subdomain as string;
      
        
        if (!tenantId) {
            return errorResponse.sendError({
                res,
                statusCode: 400,
                message: "Tenant subdomain header (x-tenant-subdomain) is required"
            })
        }
       

        try {
           const tenant = await this.tenantService.getTenantSettings(tenantId);
            

            if (!tenant) {
                return errorResponse.sendError({
                    res,
                    statusCode: 404,
                    message: "Settings not found for the tenant"
                });
            }

            const updatedSetting = await this.settingService.findSettingTenantById(req.tenantConnection!, tenant._id);
            
            
            let settings;
            if(!updatedSetting){
                
                
                settings = await this.settingService.createSetting(req.tenantConnection!, { tenant: tenant._id, ...req.body });
            }else{
                
                settings = await this.settingService.updateSetting(req.tenantConnection!, updatedSetting?._id as string, req.body);
            }

            return responseResult.sendResponse({
                res,
                statusCode: 200,
                message: "Settings updated successfully",
                data: settings
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
}

export default new SettingController().router;