# Multi-Tenancy Environment Configuration

## Required Environment Variables

Create a `.env` file in your project root with the following variables:

```env
# Server Configuration
PORT=3000
BASE_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Main Database Configuration (for tenant management)
DB_HOST=localhost
DB_PORT=27017
DB_NAME=pos_main
DB_USERNAME=admin
DB_PASSWORD=adminpassword

# JWT Configuration
JWT_ACCESS_SECRET=your-super-long-access-secret-key-here
JWT_REFRESH_SECRET=your-super-long-refresh-secret-key-here
ACCESS_TTL=15m
REFRESH_TTL=7d
JWT_ALGORITHM=HS256
```

## MongoDB Setup for Multi-Tenancy

### 1. Create Admin User

First, create an admin user in MongoDB that can create databases and users:

```javascript
// Connect to MongoDB as root/admin
use admin

// Create admin user
db.createUser({
  user: "admin",
  pwd: "adminpassword",
  roles: [
    { role: "userAdminAnyDatabase", db: "admin" },
    { role: "dbAdminAnyDatabase", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" }
  ]
})
```

### 2. Create Main Database

```javascript
// Create main database for tenant management
use pos_main

// Create a collection to initialize the database
db.tenants.insertOne({
  name: "System",
  subdomain: "system",
  createdAt: new Date()
})
```

### 3. Example Tenant Database Structure

When a tenant is created, the system automatically:

1. Creates a new database (e.g., `db_acme_corporation`)
2. Creates a user with readWrite permissions on that database
3. Stores tenant information in the main database

Example tenant database:
```javascript
// Tenant database: db_acme_corporation
use db_acme_corporation

// Collections that will be created automatically:
db.users.find()      // Tenant's users
db.products.find()   // Tenant's products (future)
db.orders.find()     // Tenant's orders (future)
// etc.
```

## Docker Compose Example

For easy development setup:

```yaml
# docker-compose.yml
version: '3.8'

services:
  mongodb:
    image: mongo:latest
    container_name: pos-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: adminpassword
      MONGO_INITDB_DATABASE: pos_main
    volumes:
      - mongodb_data:/data/db
      - ./init-mongo.js:/docker-entrypoint-initdb.d/init-mongo.js:ro

  app:
    build: .
    container_name: pos-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    env_file:
      - .env
    depends_on:
      - mongodb
    volumes:
      - .:/app
      - /app/node_modules

volumes:
  mongodb_data:
```

## MongoDB Initialization Script

Create `init-mongo.js` for Docker setup:

```javascript
// init-mongo.js
db = db.getSiblingDB('pos_main');

db.createCollection('tenants');

db.tenants.insertOne({
    name: 'System Tenant',
    subdomain: 'system',
    databaseName: 'pos_main',
    databaseUser: 'admin',
    databasePassword: 'adminpassword',
    createdAt: new Date(),
    updatedAt: new Date()
});

print('Main database initialized successfully');
```

## Security Considerations

### 1. Database Credentials
- Generate strong, unique passwords for each tenant
- Store credentials securely (consider encryption at rest)
- Rotate credentials periodically

### 2. Connection Limits
- Monitor connection counts per tenant
- Implement rate limiting if needed
- Set appropriate connection timeouts

### 3. Data Isolation
- Each tenant has completely separate database
- No shared collections or data
- Proper tenant validation in all operations

### 4. Backup Strategy
- Backup main tenant database regularly
- Implement per-tenant backup schedules
- Test restore procedures

## Monitoring and Maintenance

### 1. Connection Monitoring
```javascript
// Check active connections
const connectionManager = TenantConnectionManager.getInstance();
console.log('Active connections:', connectionManager.getActiveConnectionsCount());
```

### 2. Tenant Database Health Check
```javascript
// Test tenant connections
const tenantService = TenantService.getInstance();
const isHealthy = await tenantService.testTenantConnection(tenant);
```

### 3. Cleanup Procedures
- Unused connections are automatically cleaned up after 30 minutes
- Graceful shutdown closes all connections
- Monitor for connection leaks

## Development vs Production

### Development
- Use local MongoDB instance
- Single admin user for all operations
- Relaxed connection limits

### Production
- Use MongoDB Atlas or managed MongoDB
- Separate admin users for different environments
- Strict connection limits and monitoring
- SSL/TLS encryption
- Network security (VPC, firewall rules)
- Regular security audits

## Performance Optimization

### 1. Connection Pooling
- Each tenant connection maintains its own pool
- Configurable pool sizes based on usage
- Connection reuse for better performance

### 2. Caching
- Cache frequently accessed tenant information
- Implement Redis for session management
- Cache database connections for active tenants

### 3. Indexing
- Create appropriate indexes in tenant databases
- Monitor query performance
- Optimize based on usage patterns

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Check MongoDB is running
   - Verify credentials in .env file
   - Check network connectivity

2. **Tenant Not Found**
   - Verify subdomain is correct
   - Check tenant exists in main database
   - Validate subdomain format

3. **Database Creation Failed**
   - Check admin user permissions
   - Verify MongoDB version compatibility
   - Check disk space and limits

4. **Memory Issues**
   - Monitor connection counts
   - Adjust connection TTL
   - Implement connection limits

### Logging

Enable detailed logging in development:
```env
NODE_ENV=development
LOG_LEVEL=debug
```

Check logs for:
- Connection establishment/cleanup
- Tenant resolution
- Database operations
- Error traces
```
