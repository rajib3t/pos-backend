import { MongoClient } from "mongodb";
import { dbConfig } from "../config";
import Logging from "../libraries/logging.library";

class CreateDatabase {
  private dbUri: string;

  constructor() {
    const dbHost = dbConfig.host || "localhost";
    const dbPort = dbConfig.port || 27017;
    const dbUsername = dbConfig.username || "admin";
    const dbPassword = dbConfig.password || "secret";

    // Connect as admin user (who has privilege to create users)
    this.dbUri = `mongodb://${dbUsername}:${dbPassword}@${dbHost}:${dbPort}/admin`;
  }

  public async createDatabase(
    dbName: string,
    username: string,
    password: string
  ): Promise<void> {
    const client = new MongoClient(this.dbUri);
    try {
      await client.connect();
      const db = client.db(dbName); // Reference to target DB

      // Ensure at least one collection exists (forces db creation)
      await db.createCollection("initCollection").catch(() => {
        Logging.info("Collection already exists or DB initialized.");
      });

      // Create user with readWrite role on this DB
      await db.command({
        createUser: username,
        pwd: password,
        roles: [{ role: "readWrite", db: dbName }],
      });

      Logging.info(`Database '${dbName}' initialized with user '${username}'`);
    } catch (error) {
      Logging.error(`Failed to create database: ${error}`);
    } finally {
      await client.close();
    }
  }

  public async deleteDatabase(
    dbName: string,
    username?: string
  ): Promise<void> {
    const client = new MongoClient(this.dbUri);
    try {
      await client.connect();
      const adminDb = client.db("admin");

      // Delete the user if username is provided
      if (username) {
        try {
          await adminDb.command({
            dropUser: username,
          });
          Logging.info(`User '${username}' deleted successfully`);
        } catch (userError) {
          Logging.warning(`Failed to delete user '${username}': ${userError}`);
        }
      }

      // Drop the database
      const targetDb = client.db(dbName);
      await targetDb.dropDatabase();

      Logging.info(`Database '${dbName}' deleted successfully`);
    } catch (error) {
      Logging.error(`Failed to delete database '${dbName}': ${error}`);
      throw error;
    } finally {
      await client.close();
    }
  }
}

export default new CreateDatabase();
