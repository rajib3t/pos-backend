import { Request } from "express";

export default interface TenantContext {
   validateTenantContext(req: Request): void;
}


