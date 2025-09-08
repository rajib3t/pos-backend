import { Router } from "express";
import UserController from "../controllers/user.controller";
import SimpleTenantMiddleware from "../middlewares/simpleTenantMiddleware";

const userRouter: Router = Router();

// Use optional tenant middleware - allows both landlord and tenant requests
userRouter.use(SimpleTenantMiddleware.optionalTenant);

// Define user routes
const userRoutes = [
    {
        path: '/',
        route: UserController
    }
];

// Register routes
userRoutes.forEach((route) => {
    userRouter.use(route.path, route.route);
});

export default userRouter;
