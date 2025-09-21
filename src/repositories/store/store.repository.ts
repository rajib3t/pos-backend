import BaseRepository from "../base.repository";
import Store, {IStore}  from "../../models/store/store.model";
import { Connection } from "mongoose";


export  default class StoreRepository extends BaseRepository<IStore> {

    constructor(connection?: Connection){
        if (connection) {
            super(Store, 'Store', connection);
            
        } else {
            // Use default master database connection
            super(Store);
            
        }
    }
}
   
