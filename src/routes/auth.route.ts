import { Router } from "express";
import LoginController from "../controllers/auth/login.controller";
import RegisterController from "../controllers/auth/register.controller";
import SimpleTenantMiddleware from "../middlewares/simpleTenantMiddleware";

const authRouts: Router = Router();

// Use optional tenant middleware - allows both landlord and tenant requests
authRouts.use(SimpleTenantMiddleware.optionalTenant);

// Define default routes configuration
const defaultRoutes = [
    {
        path: '/',
        route: LoginController
    },
    {
        path: '/',
        route: RegisterController
    }
];

// Register routes by iterating through default routes
defaultRoutes.forEach((route) => {
    authRouts.use(route.path, route.route);
});

// Export the configured router
export default authRouts;