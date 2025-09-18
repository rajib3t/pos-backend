import Express from 'express';
import bodyParser from "body-parser";
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { appConfig } from './config';
import routes from './routes';
import database, { IDatabase  } from './database';
import Logging from './libraries/logging.library';
import { TenantConnectionService } from './services/tenantConnection.service';
import { initializeEventSystem } from './events';
import EventService from './events/EventService';
import RedisService from './services/redis.service';

class App {
    private app: Express.Application; // Express application instance
    private port: number;
    private database!: IDatabase;
    private tenantConnectionService: TenantConnectionService;
    private redisService: RedisService;

    constructor() {
        this.app = Express(); // Initialize Express application
        this.port = appConfig.port; // Use port from appConfig
        this.tenantConnectionService = TenantConnectionService.getInstance();
        this.redisService = RedisService.getInstance();
        this.setupMiddleware(); // Setup middleware
        this.initDatabase(); // Initialize database connection
        this.initializeEventSystem(); // Initialize event system
        this.setupGracefulShutdown(); // Setup graceful shutdown
    }

    private async setupMiddleware(): Promise<void> {
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: true }));
        this.app.use(cors({
            origin: appConfig.allowedOrigins,
            credentials: true
        }));
        this.app.use(cookieParser());
        this.app.use('/', routes);
    }

       private async initDatabase(): Promise<void> {
        try {
            this.database = database;
            await this.database.connect();
          
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw error;
        }
    }

    /**
     * Initialize event system
     */
    private initializeEventSystem(): void {
        try {
            const { eventEmitter, eventManager } = initializeEventSystem();
            
            // Emit server initialization event
            eventEmitter.emitEvent('system.server.initializing', {
                port: this.port,
                environment: process.env.NODE_ENV || 'development'
            });

            Logging.info('Event system initialized successfully');
        } catch (error) {
            Logging.error('Failed to initialize event system:', error);
            throw error;
        }
    }

    /**
     * Start the server
     * @returns {Promise<void>} A promise that resolves when the server starts
     */
    public async start():  Promise<void>  {
        try {
            // Initialize cache before starting the server
            await this.initCache();
            //await this.initDatabase(); // Initialize the database connection
            return new Promise((resolve) => {
                this.app.listen(this.port, () => {
                    Logging.info(`Server running on port ${this.port}`); // Log the port number
                    Logging.info(`CORS enabled for origin: ${appConfig.allowedOrigins}`); // Log the CORS configuration
                    Logging.info(`Active tenant connections: ${this.tenantConnectionService.getActiveConnectionsCount()}`);
                    
                    // Emit server started event
                    EventService.emitServerStarted(this.port);
                    
                    resolve();
                });
            });
        } catch (error) {
            Logging.error(`Failed to start server: ${error}`);
            process.exit(1);
        }
    }

    /**
     * Initialize Redis cache connection
     */
    private async initCache(): Promise<void> {
        try {
            await this.redisService.connect();
        } catch (error) {
            Logging.error('Failed to initialize Redis cache:', error);
            // Depending on requirements, either throw to prevent server start or continue without cache
            // throw error;
        }
    }

    /**
     * Setup graceful shutdown for tenant connections
     */
    private setupGracefulShutdown(): void {
        const gracefulShutdown = async (signal: string) => {
            Logging.info(`Received ${signal}. Closing server gracefully...`);
            
            // Emit server shutdown event
            EventService.emitServerShutdown(`Received ${signal}`);
            
            try {
                // Close all tenant connections
                await this.tenantConnectionService.closeAllConnections();
                Logging.info('All tenant connections closed');
                
                // Close main database connection
                // Note: mongoose.connection.close() is handled automatically
                
                // Close Redis connection
                await this.redisService.disconnect();
                
                process.exit(0);
            } catch (error) {
                Logging.error(`Error during graceful shutdown: ${error}`);
                process.exit(1);
            }
        };

        // Handle various shutdown signals
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon restart
    }
}


// Singleton pattern for the server
const server = new App();
server.start().then(() => {
    Logging.info('Server is fully initialized');
    Logging.info(`Base URL: ${appConfig.baseUrl}`); // Log the base URL
}).catch(err => {
    Logging.error(`Server initialization failed: ${err}`);
});

export default server;


