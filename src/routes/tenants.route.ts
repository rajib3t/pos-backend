import { Router } from "express";
import SettingController from "../controllers/tenants/setting.controller";
import AuthMiddleware from "../middlewares/authMiddleware";
import SimpleTenantMiddleware from "../middlewares/simpleTenantMiddleware";
const tenantsRouter: Router = Router();
tenantsRouter.use(SimpleTenantMiddleware.optionalTenant);
// Define default routes configuration
const defaultRoutes  = [
    {
        path: '/',
        route: SettingController
    }
];

defaultRoutes.forEach(route => {
    tenantsRouter.use(route.path, AuthMiddleware.getInstance().handle, route.route);
});

export default tenantsRouter;
