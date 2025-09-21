import { Connection } from "mongoose";


import MaterialCategory, { IMaterialCategory } from "../../models/materials/material-category.model";
import { PaginatedResult, PaginationOptions, Repository } from "../repository";
import BaseRepository from "../base.repository";

export default class MaterialCategoryRepository  extends BaseRepository<IMaterialCategory>{


    constructor(connection?: Connection) {
        if (connection) {
           super(MaterialCategory, 'MaterialCategory', connection);
           
        } else {
            // Use default master database connection
            super(MaterialCategory);
            
        }
    }

    
}
