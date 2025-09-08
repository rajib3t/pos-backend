/**
 * Multi-Database Token Storage System Example
 * 
 * This shows how tokens are stored in different databases based on context
 */

/**
 * TOKEN STORAGE MECHANISM
 */
const tokenStorageExplanation = {
    landlordFlow: {
        description: 'Landlord tokens stored in master database',
        steps: [
            '1. User logs in without X-Tenant-Subdomain header',
            '2. req.isLandlord = true, req.tenantConnection = null',
            '3. Access token generated with landlord context',
            '4. Refresh token generated and stored in MASTER database',
            '5. Token operations (refresh/logout) use MASTER database'
        ],
        database: 'Master Database',
        tokenRepository: 'new TokenRepository() // No connection = master DB'
    },

    tenantFlow: {
        description: 'Tenant tokens stored in respective tenant database',
        steps: [
            '1. User logs in with X-Tenant-Subdomain: acme header',
            '2. req.isLandlord = false, req.tenantConnection = acme_db_connection',
            '3. Access token generated with tenant context',
            '4. Refresh token generated and stored in TENANT database (acme_db)',
            '5. Token operations (refresh/logout) use TENANT database'
        ],
        database: 'Tenant Database (tenant-specific)',
        tokenRepository: 'new TokenRepository(tenantConnection) // Uses tenant DB'
    }
};

/**
 * DATABASE ISOLATION EXAMPLES
 */
const databaseIsolationExamples = {
    
    // Landlord login - token stored in master DB
    landlordLogin: {
        request: {
            method: 'POST',
            url: '/auth/login',
            headers: {
                'Content-Type': 'application/json'
                // NO X-Tenant-Subdomain header
            },
            body: {
                email: 'admin@landlord.com',
                password: 'password123'
            }
        },
        
        tokenStorage: {
            database: 'master_database',
            collection: 'tokens',
            document: {
                _id: 'refresh_token_id_1',
                user: 'landlord_user_id',
                type: 'refresh',
                token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                isRevoked: false,
                expiresAt: '2024-09-14T12:30:56.789Z'
            }
        },
        
        context: {
            isLandlord: true,
            tenantConnection: null,
            subdomain: 'landlord'
        }
    },

    // Tenant login - token stored in tenant DB
    tenantLogin: {
        request: {
            method: 'POST',
            url: '/auth/login',
            headers: {
                'Content-Type': 'application/json',
                'X-Tenant-Subdomain': 'acme'
            },
            body: {
                email: 'john@acme.com',
                password: 'password123'
            }
        },
        
        tokenStorage: {
            database: 'tenant_acme_database',
            collection: 'tokens',
            document: {
                _id: 'refresh_token_id_2',
                user: 'tenant_user_id',
                type: 'refresh',
                token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                isRevoked: false,
                expiresAt: '2024-09-14T12:30:56.789Z'
            }
        },
        
        context: {
            isLandlord: false,
            tenantConnection: 'mongodb://acme_db_connection',
            subdomain: 'acme'
        }
    }
};

/**
 * TOKEN OPERATIONS BY CONTEXT
 */
const tokenOperationsByContext = {
    
    landlordOperations: {
        login: {
            tokenGeneration: 'generateRefreshToken(payload, null)',
            storage: 'Master Database',
            repository: 'new TokenRepository()'
        },
        
        logout: {
            tokenInvalidation: 'invalidateRefreshToken(token, null)',
            lookup: 'Master Database',
            repository: 'new TokenRepository()'
        },
        
        refresh: {
            tokenLookup: 'refreshTheAccessToken(token, null)',
            verification: 'Master Database',
            repository: 'new TokenRepository()'
        }
    },

    tenantOperations: {
        login: {
            tokenGeneration: 'generateRefreshToken(payload, tenantConnection)',
            storage: 'Tenant Database',
            repository: 'new TokenRepository(tenantConnection)'
        },
        
        logout: {
            tokenInvalidation: 'invalidateRefreshToken(token, tenantConnection)',
            lookup: 'Tenant Database',
            repository: 'new TokenRepository(tenantConnection)'
        },
        
        refresh: {
            tokenLookup: 'refreshTheAccessToken(token, tenantConnection)',
            verification: 'Tenant Database',
            repository: 'new TokenRepository(tenantConnection)'
        }
    }
};

/**
 * SECURITY BENEFITS
 */
const securityBenefits = {
    dataIsolation: 'Tenant tokens cannot be accessed from master database and vice versa',
    compromiseContainment: 'If one tenant database is compromised, other tenants are unaffected',
    accessControl: 'Landlord tokens work only with master database, tenant tokens only with tenant database',
    auditTrail: 'Clear separation of token operations per tenant for better auditing',
    scalability: 'Each tenant database can be scaled independently'
};

/**
 * PRACTICAL EXAMPLES
 */
const practicalExamples = `
# ===== LANDLORD TOKEN FLOW =====

# 1. Landlord Login (stores token in master DB)
curl -X POST http://localhost:3000/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "admin@landlord.com",
    "password": "password123"
  }'

# Response: Token stored in master_database.tokens collection

# 2. Landlord Logout (invalidates token in master DB)
curl -X POST http://localhost:3000/auth/logout \\
  -H "Content-Type: application/json" \\
  -H "Cookie: refreshToken=LANDLORD_REFRESH_TOKEN"

# 3. Landlord Token Refresh (looks up token in master DB)
curl -X POST http://localhost:3000/auth/refresh \\
  -H "Content-Type: application/json" \\
  -H "Cookie: refreshToken=LANDLORD_REFRESH_TOKEN"

# ===== TENANT TOKEN FLOW =====

# 1. Tenant Login (stores token in tenant DB)
curl -X POST http://localhost:3000/auth/login \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-Subdomain: acme" \\
  -d '{
    "email": "john@acme.com",
    "password": "password123"
  }'

# Response: Token stored in tenant_acme_database.tokens collection

# 2. Tenant Logout (invalidates token in tenant DB)
curl -X POST http://localhost:3000/auth/logout \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-Subdomain: acme" \\
  -H "Cookie: refreshToken=TENANT_REFRESH_TOKEN"

# 3. Tenant Token Refresh (looks up token in tenant DB)
curl -X POST http://localhost:3000/auth/refresh \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-Subdomain: acme" \\
  -H "Cookie: refreshToken=TENANT_REFRESH_TOKEN"

# ===== ISOLATION DEMONSTRATION =====

# Landlord token cannot access tenant data
curl -X GET http://localhost:3000/users \\
  -H "Authorization: Bearer LANDLORD_TOKEN" \\
  -H "X-Tenant-Subdomain: acme"
# Result: Works but uses master database (landlord context)

# Tenant token cannot access landlord data
curl -X GET http://localhost:3000/users \\
  -H "Authorization: Bearer TENANT_TOKEN"
# Result: Requires X-Tenant-Subdomain header for proper context
`;

/**
 * IMPLEMENTATION DETAILS
 */
const implementationDetails = {
    tokenServiceEnhancement: {
        newMethods: [
            'generateRefreshToken(payload, connection?)',
            'refreshTheAccessToken(token, connection?)',
            'invalidateRefreshToken(token, connection?)',
            'getTokenRepository(connection?)'
        ],
        connectionLogic: 'If connection provided → tenant DB, else → master DB'
    },

    tokenRepositoryEnhancement: {
        constructor: 'TokenRepository(connection?) - accepts optional tenant connection',
        modelSelection: 'Uses TenantModelFactory for tenant connections, default Token model for master'
    },

    controllerUpdates: {
        login: 'Passes req.tenantConnection to token generation',
        logout: 'Passes req.tenantConnection to token invalidation', 
        refresh: 'Passes req.tenantConnection to token refresh'
    }
};

/**
 * TESTING SCENARIOS
 */
const testingScenarios = {
    
    scenario1: {
        name: 'Landlord Complete Auth Flow',
        steps: [
            'Login as landlord (no header)',
            'Verify token stored in master DB',
            'Refresh token using master DB',
            'Logout and verify token invalidated in master DB'
        ]
    },

    scenario2: {
        name: 'Tenant Complete Auth Flow',
        steps: [
            'Login as tenant (with X-Tenant-Subdomain)',
            'Verify token stored in tenant DB',
            'Refresh token using tenant DB',
            'Logout and verify token invalidated in tenant DB'
        ]
    },

    scenario3: {
        name: 'Cross-Context Token Isolation',
        steps: [
            'Login as landlord and tenant separately',
            'Verify tokens are in different databases',
            'Attempt to use landlord token for tenant operations',
            'Verify proper isolation and security'
        ]
    }
};

export {
    tokenStorageExplanation,
    databaseIsolationExamples,
    tokenOperationsByContext,
    securityBenefits,
    practicalExamples,
    implementationDetails,
    testingScenarios
};
