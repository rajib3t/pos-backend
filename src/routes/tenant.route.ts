import { Router } from "express";
import TenantController from "../controllers/tenant.controller";
import AuthMiddleware from "../middlewares/authMiddleware";
import TenantUserController from "../controllers/tenant-users.controller";
const tenantRouter: Router = Router();

// Define route configuration with explicit middleware order
const routeConfigurations = [
    {
        path: '/',
        controller: TenantController,
        middlewares: [AuthMiddleware.getInstance().handle], // Auth required for tenant operations
        description: 'Tenant CRUD operations (landlord only)'
    },
    {
        path: "/",
        controller: TenantUserController,
        middlewares: [AuthMiddleware.getInstance().handle], // Auth required for tenant user operations
        description: 'Tenant user management operations'
    }
];

// Register routes with explicit middleware order
// Tenant operations are landlord operations, so no tenant middleware needed
routeConfigurations.forEach((config) => {
    // Apply middlewares in order: [auth] -> controller
    tenantRouter.use(config.path, ...config.middlewares, config.controller);
});

export default tenantRouter;