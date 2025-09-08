import mongoose from "mongoose";
import {dbConfig} from '../config';
import Logging from "../libraries/logging.library";

class Database {
    private dbUri: string;
    private dbHost: string;
    private dbPort: number;
    private dbName: string;
    private dbUsername: string;
    private dbPassword: string;

    constructor() {
        this.dbHost = dbConfig.host || "localhost";
        this.dbPort = dbConfig.port || 27017;
        this.dbName = dbConfig.name || "mydatabase";
        this.dbUsername = dbConfig.username || "admin";
        this.dbPassword = dbConfig.password || "secret";
        this.dbUri = `mongodb://${this.dbUsername}:${this.dbPassword}@${this.dbHost}:${this.dbPort}/${this.dbName}?authSource=admin`;

        Logging.info(`Database URI: ${this.dbUri}`);

    }

    public async connect(): Promise<void> {
        try {
            await mongoose.connect(this.dbUri);
            Logging.info("Master Database connected successfully");
        } catch (error) {
            Logging.error(`Database connection failed: ${error}`);
            process.exit(1);
        }
    }
}

export default new Database();


export interface IDatabase {
    connect(): Promise<void>;
}