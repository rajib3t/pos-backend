import { Router } from "express";
import ProfileController from "../controllers/profile.controller";
import AuthMiddleware from "../middlewares/authMiddleware";
import SimpleTenantMiddleware from "../middlewares/simpleTenantMiddleware";
const profileRouter: Router = Router();
profileRouter.use(SimpleTenantMiddleware.optionalTenant);
// Define default routes configuration
const defaultRoutes  = [
    {
        path: '/',
        route: ProfileController
    },
    
    
];



// Register routes by iterating through default routes
defaultRoutes.forEach((route) => {
    profileRouter.use(route.path, AuthMiddleware.getInstance().handle, route.route);
});


export default profileRouter;