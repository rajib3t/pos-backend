import { appConfig } from '../config';

/**
 * Multi-Tenancy API Usage Examples
 * 
 * This file demonstrates how to use the enhanced multi-tenancy system
 */

// Base URL for your API
const BASE_URL = appConfig.baseUrl;

/**
 * 1. CREATE A NEW TENANT
 * 
 * POST /tenant/create
 * 
 * This creates a new tenant with its own isolated database
 */
const createTenantExample = {
    endpoint: `${BASE_URL}/tenant/create`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN' // If authentication is required
    },
    body: {
        name: 'Acme Corporation',
        subdomain: 'acme'
    },
    // Response will include generated database credentials
    expectedResponse: {
        data: {
            _id: 'tenant_id',
            name: 'Acme Corporation',
            subdomain: 'acme',
            databaseName: 'db_acme_corporation',
            databaseUser: 'user_acme_corporation',
            databasePassword: 'generated_password',
            createdAt: '2025-09-07T...',
            updatedAt: '2025-09-07T...'
        },
        message: 'Tenant created successfully',
        statusCode: 201
    }
};

/**
 * 2. CREATE USERS IN TENANT DATABASE
 * 
 * POST /tenant-users/
 * 
 * This creates users in the tenant's isolated database
 * The tenant is identified via subdomain
 */
const createTenantUserExample = {
    endpoint: `${BASE_URL}/tenant-users/`,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Subdomain': 'acme', // Method 1: Via header
        // Alternative methods to specify tenant:
        // Host: 'acme.yourdomain.com'  // Method 2: Via subdomain
    },
    body: {
        name: 'John Doe',
        email: 'john@acme.com',
        mobile: '+1234567890',
        password: 'securepassword123'
    },
    // You can also pass subdomain in query or body:
    alternativeWays: [
        `${BASE_URL}/tenant-users/?subdomain=acme`, // Method 3: Query parameter
        // Or include subdomain in request body           // Method 4: In body
    ]
};

/**
 * 3. GET TENANT USERS WITH PAGINATION
 * 
 * GET /tenant-users/?page=1&limit=10
 */
const getTenantUsersExample = {
    endpoint: `${BASE_URL}/tenant-users/?page=1&limit=10`,
    method: 'GET',
    headers: {
        'X-Tenant-Subdomain': 'acme'
    },
    expectedResponse: {
        data: {
            data: [
                {
                    _id: 'user_id',
                    name: 'John Doe',
                    email: 'john@acme.com',
                    mobile: '+1234567890',
                    isActive: true,
                    createdAt: '2025-09-07T...',
                    updatedAt: '2025-09-07T...'
                    // password is excluded from response
                }
            ],
            total: 1,
            page: 1,
            totalPages: 1
        },
        message: 'Users retrieved successfully'
    }
};

/**
 * 4. SEARCH USERS WITHIN TENANT
 * 
 * GET /tenant-users/search/:term
 */
const searchTenantUsersExample = {
    endpoint: `${BASE_URL}/tenant-users/search/john`,
    method: 'GET',
    headers: {
        'X-Tenant-Subdomain': 'acme'
    }
};

/**
 * 5. GET TENANT STATISTICS
 * 
 * GET /tenant-users/stats/count
 */
const getTenantStatsExample = {
    endpoint: `${BASE_URL}/tenant-users/stats/count`,
    method: 'GET',
    headers: {
        'X-Tenant-Subdomain': 'acme'
    },
    expectedResponse: {
        data: {
            activeUsers: 5,
            tenant: 'Acme Corporation',
            subdomain: 'acme'
        },
        message: 'User statistics retrieved successfully'
    }
};

/**
 * EXAMPLE USING JAVASCRIPT FETCH
 */
const exampleFetchRequests = {
    
    // Create a tenant
    createTenant: async () => {
        const response = await fetch(`${BASE_URL}/tenant/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_JWT_TOKEN'
            },
            body: JSON.stringify({
                name: 'Test Company',
                subdomain: 'testco'
            })
        });
        return await response.json();
    },

    // Create user in tenant database
    createTenantUser: async () => {
        const response = await fetch(`${BASE_URL}/tenant-users/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Subdomain': 'testco'
            },
            body: JSON.stringify({
                name: 'Alice Smith',
                email: 'alice@testco.com',
                password: 'password123'
            })
        });
        return await response.json();
    },

    // Get tenant users
    getTenantUsers: async () => {
        const response = await fetch(`${BASE_URL}/tenant-users/?page=1&limit=10`, {
            method: 'GET',
            headers: {
                'X-Tenant-Subdomain': 'testco'
            }
        });
        return await response.json();
    }
};

/**
 * CURL EXAMPLES
 */
const curlExamples = `
# Create a tenant
curl -X POST ${BASE_URL}/tenant/create \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "name": "Demo Company",
    "subdomain": "demo"
  }'

# Create user in tenant database
curl -X POST ${BASE_URL}/tenant-users/ \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-Subdomain: demo" \\
  -d '{
    "name": "Bob Johnson",
    "email": "bob@demo.com",
    "password": "securepass123"
  }'

# Get tenant users
curl -X GET "${BASE_URL}/tenant-users/?page=1&limit=5" \\
  -H "X-Tenant-Subdomain: demo"

# Search users
curl -X GET "${BASE_URL}/tenant-users/search/bob" \\
  -H "X-Tenant-Subdomain: demo"

# Get tenant stats
curl -X GET "${BASE_URL}/tenant-users/stats/count" \\
  -H "X-Tenant-Subdomain: demo"
`;

/**
 * KEY FEATURES OF THE ENHANCED MULTI-TENANCY SYSTEM:
 * 
 * 1. TENANT ISOLATION:
 *    - Each tenant has its own MongoDB database
 *    - Separate database users and passwords
 *    - Complete data isolation
 * 
 * 2. DYNAMIC CONNECTIONS:
 *    - Connections are created on-demand
 *    - Connection pooling and reuse
 *    - Automatic cleanup of unused connections
 * 
 * 3. TENANT RESOLUTION:
 *    - Multiple ways to identify tenant (header, subdomain, query, body)
 *    - Automatic tenant context injection
 *    - Validation and error handling
 * 
 * 4. SCALABLE ARCHITECTURE:
 *    - Connection limits and TTL
 *    - Graceful shutdown handling
 *    - Memory-efficient connection management
 * 
 * 5. SECURITY:
 *    - Tenant-specific database credentials
 *    - Isolated data access
 *    - Proper authentication and authorization
 */

export {
    createTenantExample,
    createTenantUserExample,
    getTenantUsersExample,
    searchTenantUsersExample,
    getTenantStatsExample,
    exampleFetchRequests,
    curlExamples
};
