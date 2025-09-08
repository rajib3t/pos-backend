/**
 * Simplified Multi-Tenancy Usage Examples
 * 
 * This demonstrates the simplified approach where:
 * 1. Check subdomain against master database
 * 2. Fetch tenant credentials from master database
 * 3. Create tenant connection dynamically
 * 4. Use existing models with tenant connection
 */

import { appConfig } from '../config';

const BASE_URL = appConfig.baseUrl;

/**
 * STEP 1: CREATE A TENANT (This goes to master database)
 */
const createTenantExample = {
    method: 'POST',
    url: `${BASE_URL}/tenant/create`,
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer YOUR_JWT_TOKEN'
    },
    body: {
        name: 'Acme Corporation',
        subdomain: 'acme'
    },
    // This creates:
    // - Record in master database
    // - New database: db_acme_corporation
    // - Database user: user_acme_corporation
    // - Random password
};

/**
 * STEP 2: USE EXISTING USER ENDPOINTS WITH TENANT CONTEXT
 * 
 * The magic happens in the middleware:
 * 1. Extract subdomain from request
 * 2. Query master database for tenant info
 * 3. Create connection using tenant credentials
 * 4. Use existing UserService with tenant connection
 */
const userOperationsExamples = {
    
    // Create user in tenant database
    createUser: {
        method: 'POST',
        url: `${BASE_URL}/users/`,
        headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Subdomain': 'acme'  // This identifies the tenant
        },
        body: {
            name: 'John Doe',
            email: 'john@acme.com',
            mobile: '+1234567890',
            password: 'securepassword123'
        }
    },

    // Get users from tenant database
    getUsers: {
        method: 'GET',
        url: `${BASE_URL}/users/?page=1&limit=10`,
        headers: {
            'X-Tenant-Subdomain': 'acme'
        }
    },

    // Get specific user from tenant database
    getUser: {
        method: 'GET',
        url: `${BASE_URL}/users/USER_ID`,
        headers: {
            'X-Tenant-Subdomain': 'acme'
        }
    },

    // Update user in tenant database
    updateUser: {
        method: 'PUT',
        url: `${BASE_URL}/users/USER_ID`,
        headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Subdomain': 'acme'
        },
        body: {
            name: 'John Smith',
            mobile: '+1234567891'
        }
    },

    // Search users in tenant database
    searchUsers: {
        method: 'GET',
        url: `${BASE_URL}/users/search/john`,
        headers: {
            'X-Tenant-Subdomain': 'acme'
        }
    },

    // Get user stats for tenant
    getUserStats: {
        method: 'GET',
        url: `${BASE_URL}/users/stats/count`,
        headers: {
            'X-Tenant-Subdomain': 'acme'
        }
    }
};

/**
 * ALTERNATIVE WAYS TO SPECIFY TENANT
 */
const alternativeTenantSpecification = {
    
    // Method 1: Header (Recommended for APIs)
    viaHeader: {
        headers: {
            'X-Tenant-Subdomain': 'acme'
        }
    },

    // Method 2: Query Parameter
    viaQuery: `${BASE_URL}/users/?subdomain=acme&page=1&limit=10`,

    // Method 3: Request Body (for POST/PUT requests)
    viaBody: {
        body: {
            subdomain: 'acme',
            name: 'John Doe',
            email: 'john@acme.com'
        }
    },

    // Method 4: Subdomain (if using subdomains)
    viaSubdomain: 'https://acme.yourdomain.com/users/'
};

/**
 * CURL EXAMPLES FOR TESTING
 */
const curlExamples = `
# 1. Create a tenant
curl -X POST ${BASE_URL}/tenant/create \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \\
  -d '{
    "name": "Test Company",
    "subdomain": "testco"
  }'

# 2. Create user in tenant database
curl -X POST ${BASE_URL}/users/ \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-Subdomain: testco" \\
  -d '{
    "name": "Alice Johnson",
    "email": "alice@testco.com",
    "password": "password123"
  }'

# 3. Get users from tenant database
curl -X GET "${BASE_URL}/users/?page=1&limit=5" \\
  -H "X-Tenant-Subdomain: testco"

# 4. Search users in tenant database
curl -X GET "${BASE_URL}/users/search/alice" \\
  -H "X-Tenant-Subdomain: testco"

# 5. Get user stats for tenant
curl -X GET "${BASE_URL}/users/stats/count" \\
  -H "X-Tenant-Subdomain: testco"

# 6. Update user in tenant database
curl -X PUT "${BASE_URL}/users/USER_ID" \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-Subdomain: testco" \\
  -d '{
    "name": "Alice Smith",
    "mobile": "+1234567890"
  }'
`;

/**
 * JAVASCRIPT FETCH EXAMPLES
 */
const fetchExamples = {
    
    async createTenant() {
        const response = await fetch(`${BASE_URL}/tenant/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer YOUR_JWT_TOKEN'
            },
            body: JSON.stringify({
                name: 'Demo Company',
                subdomain: 'demo'
            })
        });
        return await response.json();
    },

    async createUser() {
        const response = await fetch(`${BASE_URL}/users/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Subdomain': 'demo'
            },
            body: JSON.stringify({
                name: 'Bob Wilson',
                email: 'bob@demo.com',
                password: 'securepass123'
            })
        });
        return await response.json();
    },

    async getUsers() {
        const response = await fetch(`${BASE_URL}/users/?page=1&limit=10`, {
            method: 'GET',
            headers: {
                'X-Tenant-Subdomain': 'demo'
            }
        });
        return await response.json();
    }
};

/**
 * HOW THE SIMPLIFIED SYSTEM WORKS:
 * 
 * 1. TENANT IDENTIFICATION:
 *    - Middleware extracts subdomain from request
 *    - Multiple sources: header, query, body, subdomain
 * 
 * 2. MASTER DATABASE LOOKUP:
 *    - Check if tenant exists in master database
 *    - Fetch tenant credentials (db name, user, password)
 * 
 * 3. DYNAMIC CONNECTION:
 *    - Create connection to tenant database
 *    - Reuse existing connections for performance
 *    - Automatic cleanup of unused connections
 * 
 * 4. EXISTING MODELS:
 *    - Use existing User, Address, Token models
 *    - Models work with tenant-specific connection
 *    - No need for separate tenant models
 * 
 * 5. BACKWARD COMPATIBILITY:
 *    - Original UserService methods still work
 *    - New overloaded methods accept tenant connection
 *    - No breaking changes to existing code
 */

export {
    createTenantExample,
    userOperationsExamples,
    alternativeTenantSpecification,
    curlExamples,
    fetchExamples
};
