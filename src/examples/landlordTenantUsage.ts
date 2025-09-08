/**
 * Landlord vs Tenant Multi-Tenancy Usage Examples
 * 
 * This demonstrates how to use the same endpoints for both:
 * 1. LANDLORD requests (no X-Tenant-Subdomain header) → Main database
 * 2. TENANT requests (with X-Tenant-Subdomain header) → Tenant database
 */

import { appConfig } from '../config';

const BASE_URL = appConfig.baseUrl;

/**
 * STEP 1: CREATE A TENANT (Landlord Operation)
 * This always goes to the main database regardless of headers
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
    }
};

/**
 * STEP 2: USER OPERATIONS - LANDLORD vs TENANT
 */

// ===== LANDLORD OPERATIONS (Main Database) =====
const landlordOperations = {
    
    // Create user in MAIN database (landlord user)
    createLandlordUser: {
        method: 'POST',
        url: `${BASE_URL}/users/`,
        headers: {
            'Content-Type': 'application/json'
            // NO X-Tenant-Subdomain header = landlord request
        },
        body: {
            name: 'Landlord Admin',
            email: 'admin@landlord.com',
            password: 'securepassword123'
        }
    },

    // Get users from MAIN database
    getLandlordUsers: {
        method: 'GET',
        url: `${BASE_URL}/users/?page=1&limit=10`,
        headers: {
            // NO X-Tenant-Subdomain header = landlord request
        }
    },

    // Get specific landlord user
    getLandlordUser: {
        method: 'GET',
        url: `${BASE_URL}/users/USER_ID`,
        headers: {
            // NO X-Tenant-Subdomain header = landlord request
        }
    },

    // Update landlord user
    updateLandlordUser: {
        method: 'PUT',
        url: `${BASE_URL}/users/USER_ID`,
        headers: {
            'Content-Type': 'application/json'
            // NO X-Tenant-Subdomain header = landlord request
        },
        body: {
            name: 'Updated Landlord Admin'
        }
    },

    // Get landlord user statistics
    getLandlordStats: {
        method: 'GET',
        url: `${BASE_URL}/users/stats/count`,
        headers: {
            // NO X-Tenant-Subdomain header = landlord request
        }
    }
};

// ===== TENANT OPERATIONS (Tenant Database) =====
const tenantOperations = {
    
    // Create user in TENANT database
    createTenantUser: {
        method: 'POST',
        url: `${BASE_URL}/users/`,
        headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Subdomain': 'acme'  // This makes it a tenant request
        },
        body: {
            name: 'John Doe',
            email: 'john@acme.com',
            password: 'securepassword123'
        }
    },

    // Get users from TENANT database
    getTenantUsers: {
        method: 'GET',
        url: `${BASE_URL}/users/?page=1&limit=10`,
        headers: {
            'X-Tenant-Subdomain': 'acme'  // This makes it a tenant request
        }
    },

    // Get specific tenant user
    getTenantUser: {
        method: 'GET',
        url: `${BASE_URL}/users/USER_ID`,
        headers: {
            'X-Tenant-Subdomain': 'acme'
        }
    },

    // Update tenant user
    updateTenantUser: {
        method: 'PUT',
        url: `${BASE_URL}/users/USER_ID`,
        headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Subdomain': 'acme'
        },
        body: {
            name: 'John Smith'
        }
    },

    // Get tenant user statistics
    getTenantStats: {
        method: 'GET',
        url: `${BASE_URL}/users/stats/count`,
        headers: {
            'X-Tenant-Subdomain': 'acme'
        }
    }
};

/**
 * CURL EXAMPLES
 */
const curlExamples = `
# ===== LANDLORD OPERATIONS (Main Database) =====

# 1. Create landlord user (no tenant header)
curl -X POST ${BASE_URL}/users/ \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Landlord Admin",
    "email": "admin@landlord.com",
    "password": "password123"
  }'

# 2. Get landlord users (no tenant header)
curl -X GET "${BASE_URL}/users/?page=1&limit=5"

# 3. Get landlord user stats (no tenant header)
curl -X GET "${BASE_URL}/users/stats/count"


# ===== TENANT OPERATIONS (Tenant Database) =====

# 1. Create tenant first
curl -X POST ${BASE_URL}/tenant/create \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Acme Corp",
    "subdomain": "acme"
  }'

# 2. Create tenant user (with tenant header)
curl -X POST ${BASE_URL}/users/ \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-Subdomain: acme" \\
  -d '{
    "name": "John Doe",
    "email": "john@acme.com",
    "password": "password123"
  }'

# 3. Get tenant users (with tenant header)
curl -X GET "${BASE_URL}/users/?page=1&limit=5" \\
  -H "X-Tenant-Subdomain: acme"

# 4. Get tenant user stats (with tenant header)
curl -X GET "${BASE_URL}/users/stats/count" \\
  -H "X-Tenant-Subdomain: acme"

# 5. Search tenant users
curl -X GET "${BASE_URL}/users/search/john" \\
  -H "X-Tenant-Subdomain: acme"
`;

/**
 * JAVASCRIPT FETCH EXAMPLES
 */
const fetchExamples = {
    
    // Landlord operations
    async createLandlordUser() {
        const response = await fetch(`${BASE_URL}/users/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // NO X-Tenant-Subdomain = landlord request
            },
            body: JSON.stringify({
                name: 'Landlord User',
                email: 'landlord@example.com',
                password: 'securepass123'
            })
        });
        return await response.json();
    },

    async getLandlordUsers() {
        const response = await fetch(`${BASE_URL}/users/?page=1&limit=10`, {
            method: 'GET'
            // NO X-Tenant-Subdomain = landlord request
        });
        return await response.json();
    },

    // Tenant operations
    async createTenantUser() {
        const response = await fetch(`${BASE_URL}/users/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Subdomain': 'acme'  // This makes it a tenant request
            },
            body: JSON.stringify({
                name: 'Tenant User',
                email: 'user@acme.com',
                password: 'securepass123'
            })
        });
        return await response.json();
    },

    async getTenantUsers() {
        const response = await fetch(`${BASE_URL}/users/?page=1&limit=10`, {
            method: 'GET',
            headers: {
                'X-Tenant-Subdomain': 'acme'  // This makes it a tenant request
            }
        });
        return await response.json();
    }
};

/**
 * RESPONSE EXAMPLES
 */
const responseExamples = {
    
    // Landlord user stats response
    landlordStats: {
        data: {
            activeUsers: 5,
            context: 'landlord',
            tenant: 'Main Database',
            subdomain: 'landlord'
        },
        message: 'User statistics retrieved successfully'
    },

    // Tenant user stats response
    tenantStats: {
        data: {
            activeUsers: 12,
            context: 'tenant',
            tenant: 'Acme Corporation',
            subdomain: 'acme'
        },
        message: 'User statistics retrieved successfully'
    }
};

/**
 * KEY BENEFITS OF THIS APPROACH:
 * 
 * 1. SAME ENDPOINTS: Use identical URLs for both landlord and tenant operations
 * 2. HEADER-BASED ROUTING: Simple X-Tenant-Subdomain header determines the database
 * 3. AUTOMATIC FALLBACK: No header = landlord request (main database)
 * 4. COMPLETE ISOLATION: Tenant data never mixes with landlord data
 * 5. BACKWARD COMPATIBILITY: Existing code works without changes
 * 6. SCALABLE: Easy to add new tenants without code changes
 */

/**
 * HOW THE SYSTEM WORKS:
 * 
 * 1. REQUEST ARRIVES
 *    └── Middleware checks for X-Tenant-Subdomain header
 * 
 * 2. IF HEADER EXISTS:
 *    ├── Look up tenant in master database
 *    ├── Get tenant database credentials
 *    ├── Create connection to tenant database
 *    └── Set req.isLandlord = false
 * 
 * 3. IF NO HEADER:
 *    ├── Use main database connection
 *    ├── Set req.isLandlord = true
 *    └── Set req.subdomain = 'landlord'
 * 
 * 4. CONTROLLER:
 *    ├── Checks req.isLandlord flag
 *    ├── Routes to appropriate service method
 *    └── Uses correct database connection
 */

export {
    createTenantExample,
    landlordOperations,
    tenantOperations,
    curlExamples,
    fetchExamples,
    responseExamples
};
