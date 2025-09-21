import { Connection } from "mongoose";
import BaseRepository from "../base.repository";
import StoreMembership from "../../models/store/storeMembership.model";
export default class StoreMembershipRepository extends BaseRepository {
    constructor(connection?: Connection) {
       if(connection){
        super(StoreMembership, 'StoreMembership', connection)
       }else{
        super(StoreMembership)
       }

    }

}