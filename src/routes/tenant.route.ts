import { Router } from "express";
import TenantController from "../controllers/tenant.controller";
import AuthMiddleware from "../middlewares/authMiddleware";
import TenantUserController from "../controllers/tenant-users.controller";
const tenantRouter: Router = Router();

// Define default routes configuration
const defaultRoutes  = [
    {
        path: '/',
        route: TenantController,

    },
    {
        path: "/",
        route: TenantUserController,
    }
];

// Register routes by iterating through default routes
// Tenant operations are landlord operations, so no tenant middleware needed
defaultRoutes.forEach((route) => {
    tenantRouter.use(route.path, AuthMiddleware.getInstance().handle, route.route);
});

export default tenantRouter;