import { Router } from "express";
import SettingController from "../controllers/tenants/setting.controller";
import AuthMiddleware from "../middlewares/authMiddleware";
import SimpleTenantMiddleware from "../middlewares/simpleTenantMiddleware";
import StoreController from "../controllers/tenants/store.controller";
const tenantsRouter: Router = Router();

// Use optional tenant middleware - allows both landlord and tenant requests
tenantsRouter.use(SimpleTenantMiddleware.optionalTenant);
tenantsRouter.use(AuthMiddleware.getInstance().handle);
// Define default routes configuration
const defaultRoutes  = [
    {
        path: '/',
        route: SettingController
    },
    {
        path: "/stores",
        route: StoreController
    }
];

defaultRoutes.forEach(route => {
    tenantsRouter.use(route.path,  route.route);
});

export default tenantsRouter;
