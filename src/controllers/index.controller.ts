import { Request, Response } from "express";

import { Controller } from "./controller";

class IndexController extends Controller {
    constructor() {
        super();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get("/", this.index);
    }

    private index(req: Request, res: Response) {
        res.send("Welcome to the API");
    }
}
// Export the IndexController instance
const indexController = new IndexController();
export default indexController.router;