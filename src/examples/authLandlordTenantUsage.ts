/**
 * Auth Register/Login Examples - Landlord vs Tenant
 * 
 * This shows how auth endpoints work with both landlord and tenant contexts
 */

import { appConfig } from '../config';

const BASE_URL = appConfig.baseUrl;

/**
 * REGISTRATION EXAMPLES
 */
const registrationExamples = {
    
    // ===== LANDLORD REGISTRATION (Main Database) =====
    landlordRegister: {
        method: 'POST',
        url: `${BASE_URL}/auth/register`,
        headers: {
            'Content-Type': 'application/json'
            // NO X-Tenant-Subdomain header = landlord registration
        },
        body: {
            name: 'Landlord Admin',
            email: 'admin@landlord.com',
            password: 'securepassword123'
        },
        description: 'Registers user in main database (landlord)'
    },

    // ===== TENANT REGISTRATION (Tenant Database) =====
    tenantRegister: {
        method: 'POST',
        url: `${BASE_URL}/auth/register`,
        headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Subdomain': 'acme'  // This makes it tenant registration
        },
        body: {
            name: 'John Doe',
            email: 'john@acme.com',
            password: 'securepassword123'
        },
        description: 'Registers user in tenant database'
    }
};

/**
 * LOGIN EXAMPLES
 */
const loginExamples = {
    
    // ===== LANDLORD LOGIN (Main Database) =====
    landlordLogin: {
        method: 'POST',
        url: `${BASE_URL}/auth/login`,
        headers: {
            'Content-Type': 'application/json'
            // NO X-Tenant-Subdomain header = landlord login
        },
        body: {
            email: 'admin@landlord.com',
            password: 'securepassword123'
        },
        description: 'Login with landlord credentials from main database'
    },

    // ===== TENANT LOGIN (Tenant Database) =====
    tenantLogin: {
        method: 'POST',
        url: `${BASE_URL}/auth/login`,
        headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Subdomain': 'acme'  // This makes it tenant login
        },
        body: {
            email: 'john@acme.com',
            password: 'securepassword123'
        },
        description: 'Login with tenant credentials from tenant database'
    }
};

/**
 * RESPONSE EXAMPLES
 */
const responseExamples = {
    
    // Landlord registration response
    landlordRegisterResponse: {
        data: {
            _id: 'user_id',
            name: 'Landlord Admin',
            email: 'admin@landlord.com',
            isActive: true,
            createdAt: '2025-09-07T...',
            updatedAt: '2025-09-07T...'
            // password is excluded
        },
        message: 'Registration successful',
        statusCode: 201
    },

    // Tenant registration response
    tenantRegisterResponse: {
        data: {
            _id: 'user_id',
            name: 'John Doe',
            email: 'john@acme.com',
            isActive: true,
            createdAt: '2025-09-07T...',
            updatedAt: '2025-09-07T...'
            // password is excluded
        },
        message: 'Registration successful',
        statusCode: 201
    },

    // Landlord login response
    landlordLoginResponse: {
        data: {
            accessToken: 'jwt_access_token',
            refreshToken: 'jwt_refresh_token',
            user: {
                id: 'user_id',
                name: 'Landlord Admin',
                email: 'admin@landlord.com',
                context: 'landlord',
                subdomain: 'landlord'
            }
        },
        message: 'Login successful'
    },

    // Tenant login response
    tenantLoginResponse: {
        data: {
            accessToken: 'jwt_access_token',
            refreshToken: 'jwt_refresh_token',
            user: {
                id: 'user_id',
                name: 'John Doe',
                email: 'john@acme.com',
                context: 'tenant',
                subdomain: 'acme'
            }
        },
        message: 'Login successful'
    }
};

/**
 * CURL EXAMPLES
 */
const curlExamples = `
# ===== LANDLORD AUTH (Main Database) =====

# 1. Register landlord user
curl -X POST ${BASE_URL}/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Landlord Admin",
    "email": "admin@landlord.com",
    "password": "password123"
  }'

# 2. Login as landlord
curl -X POST ${BASE_URL}/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "admin@landlord.com",
    "password": "password123"
  }'

# ===== TENANT AUTH (Tenant Database) =====

# 1. First create tenant (landlord operation)
curl -X POST ${BASE_URL}/tenant/create \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Acme Corp",
    "subdomain": "acme"
  }'

# 2. Register tenant user
curl -X POST ${BASE_URL}/auth/register \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-Subdomain: acme" \\
  -d '{
    "name": "John Doe",
    "email": "john@acme.com",
    "password": "password123"
  }'

# 3. Login as tenant user
curl -X POST ${BASE_URL}/auth/login \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-Subdomain: acme" \\
  -d '{
    "email": "john@acme.com",
    "password": "password123"
  }'

# 4. Logout (works for both landlord and tenant)
curl -X POST ${BASE_URL}/auth/logout \\
  -H "Content-Type: application/json" \\
  -H "Cookie: refreshToken=your_refresh_token"
`;

/**
 * JAVASCRIPT FETCH EXAMPLES
 */
const fetchExamples = {
    
    // Landlord registration
    async registerLandlord() {
        const response = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // NO X-Tenant-Subdomain = landlord
            },
            body: JSON.stringify({
                name: 'Landlord User',
                email: 'landlord@example.com',
                password: 'securepass123'
            })
        });
        return await response.json();
    },

    // Tenant registration
    async registerTenant() {
        const response = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Subdomain': 'acme'  // Tenant context
            },
            body: JSON.stringify({
                name: 'Tenant User',
                email: 'user@acme.com',
                password: 'securepass123'
            })
        });
        return await response.json();
    },

    // Landlord login
    async loginLandlord() {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // NO X-Tenant-Subdomain = landlord
            },
            body: JSON.stringify({
                email: 'landlord@example.com',
                password: 'securepass123'
            })
        });
        return await response.json();
    },

    // Tenant login
    async loginTenant() {
        const response = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Subdomain': 'acme'  // Tenant context
            },
            body: JSON.stringify({
                email: 'user@acme.com',
                password: 'securepass123'
            })
        });
        return await response.json();
    }
};

/**
 * COMPLETE WORKFLOW EXAMPLE
 */
const completeWorkflow = `
# STEP 1: Register and login as landlord
curl -X POST ${BASE_URL}/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Admin", "email": "admin@system.com", "password": "admin123"}'

curl -X POST ${BASE_URL}/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email": "admin@system.com", "password": "admin123"}'

# STEP 2: Create tenant (as landlord)
curl -X POST ${BASE_URL}/tenant/create \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer LANDLORD_TOKEN" \\
  -d '{"name": "Client Company", "subdomain": "client"}'

# STEP 3: Register tenant users
curl -X POST ${BASE_URL}/auth/register \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-Subdomain: client" \\
  -d '{"name": "Client User", "email": "user@client.com", "password": "user123"}'

# STEP 4: Login as tenant user
curl -X POST ${BASE_URL}/auth/login \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-Subdomain: client" \\
  -d '{"email": "user@client.com", "password": "user123"}'

# STEP 5: Use tenant-specific operations
curl -X GET "${BASE_URL}/users/" \\
  -H "X-Tenant-Subdomain: client" \\
  -H "Authorization: Bearer TENANT_TOKEN"
`;

/**
 * IMPORTANT NOTES:
 * 
 * 1. ISOLATION: Landlord and tenant users are completely isolated
 * 2. SAME ENDPOINTS: Use same /auth/register and /auth/login for both
 * 3. HEADER DETERMINES CONTEXT: X-Tenant-Subdomain presence decides database
 * 4. TOKENS: JWT tokens work the same for both landlord and tenant
 * 5. SECURITY: Tenant users can't access landlord data and vice versa
 */

export {
    registrationExamples,
    loginExamples,
    responseExamples,
    curlExamples,
    fetchExamples,
    completeWorkflow
};
