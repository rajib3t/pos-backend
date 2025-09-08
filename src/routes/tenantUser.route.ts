import { Router } from "express";
import TenantUserController from "../controllers/tenantUserController";
import TenantMiddleware from "../middlewares/tenantMiddleware";

const tenantUserRouter: Router = Router();

// All tenant user routes require tenant context
tenantUserRouter.use(TenantMiddleware.resolveTenant);
tenantUserRouter.use(TenantMiddleware.requireTenant);

// Define tenant user routes
const tenantUserRoutes = [
    {
        path: '/',
        route: TenantUserController
    }
];

// Register routes
tenantUserRoutes.forEach((route) => {
    tenantUserRouter.use(route.path, route.route);
});

export default tenantUserRouter;
