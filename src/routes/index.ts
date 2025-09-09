import { Router } from "express";
import { RouteConfig } from "../types/route";
import indexController from "../controllers/index.controller";
import authRouts from "./auth.route";
import profileRouter from "./profile.route";
import tenantRouter from "./tenant.route";
import userRouter from "./user.route";
import tenantsRouter from "./tenants.route";
class AppRouter{
    private router: Router;
    private routes: RouteConfig[];

    constructor(){
        this.router = Router();
        this.routes = [
            {
                path: "/",
                route: indexController
            },
            {
                path: "/auth",
                route: authRouts
            },
            {
                path: "/profile",
                route: profileRouter
            },
            {
                path: "/tenant",
                route: tenantRouter
            },
            {
                path: "/users",
                route: userRouter
            },
            {
                path: "/tenants",
                route: tenantsRouter
            }
        ];
    }



    private setupRoutes(): void {
    
        
        
        this.routes.forEach((route) => {
            this.router.use(route.path, route.route);
        });
    }


    public getRouter(): Router {
        
        this.setupRoutes();
        return this.router;
    }
}


// Create and export router instance
const appRouter = new AppRouter();
export default appRouter.getRouter();