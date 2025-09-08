/**
 * Multi-Tenant Profile Controller Examples
 * 
 * This shows how the profile system works with both landlord and tenant contexts
 */

/**
 * PROFILE OPERATIONS BY CONTEXT
 */
const profileOperationsByContext = {
    
    landlordOperations: {
        getProfile: {
            description: 'Get landlord profile from master database',
            method: 'getUserProfile(userId)',
            database: 'Master Database',
            repository: 'new AddressRepository()'
        },
        
        updateProfile: {
            description: 'Update landlord profile in master database',
            method: 'update(userId, userData)',
            database: 'Master Database',
            repository: 'new AddressRepository()'
        },
        
        updatePassword: {
            description: 'Update landlord password in master database',
            method: 'update(userId, { password })',
            database: 'Master Database'
        }
    },

    tenantOperations: {
        getProfile: {
            description: 'Get tenant profile from tenant database',
            method: 'getUserProfile(tenantConnection, userId)',
            database: 'Tenant Database',
            repository: 'new AddressRepository(tenantConnection)'
        },
        
        updateProfile: {
            description: 'Update tenant profile in tenant database',
            method: 'update(tenantConnection, userId, userData)',
            database: 'Tenant Database',
            repository: 'new AddressRepository(tenantConnection)'
        },
        
        updatePassword: {
            description: 'Update tenant password in tenant database',
            method: 'update(tenantConnection, userId, { password })',
            database: 'Tenant Database'
        }
    }
};

/**
 * PROFILE REQUEST EXAMPLES
 */
const profileRequestExamples = {
    
    // Landlord profile operations
    landlordProfile: {
        getProfile: {
            method: 'GET',
            url: '/profile',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer LANDLORD_ACCESS_TOKEN'
                // NO X-Tenant-Subdomain header
            },
            description: 'Get landlord profile from master database'
        },

        updateProfile: {
            method: 'PATCH',
            url: '/profile',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer LANDLORD_ACCESS_TOKEN'
                // NO X-Tenant-Subdomain header
            },
            body: {
                name: 'Updated Landlord Name',
                email: 'newemail@landlord.com',
                mobile: '+1234567890',
                address: '123 Landlord Street',
                city: 'Landlord City',
                state: 'LC',
                postalCode: '12345'
            },
            description: 'Update landlord profile in master database'
        },

        updatePassword: {
            method: 'PATCH',
            url: '/profile/password',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer LANDLORD_ACCESS_TOKEN'
                // NO X-Tenant-Subdomain header
            },
            body: {
                currentPassword: 'currentpass123',
                newPassword: 'newpass123'
            },
            description: 'Update landlord password in master database'
        }
    },

    // Tenant profile operations
    tenantProfile: {
        getProfile: {
            method: 'GET',
            url: '/profile',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer TENANT_ACCESS_TOKEN',
                'X-Tenant-Subdomain': 'acme'
            },
            description: 'Get tenant profile from tenant database'
        },

        updateProfile: {
            method: 'PATCH',
            url: '/profile',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer TENANT_ACCESS_TOKEN',
                'X-Tenant-Subdomain': 'acme'
            },
            body: {
                name: 'Updated Tenant Name',
                email: 'newemail@acme.com',
                mobile: '+1987654321',
                address: '456 Tenant Avenue',
                city: 'Tenant City',
                state: 'TC',
                postalCode: '67890'
            },
            description: 'Update tenant profile in tenant database'
        },

        updatePassword: {
            method: 'PATCH',
            url: '/profile/password',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer TENANT_ACCESS_TOKEN',
                'X-Tenant-Subdomain': 'acme'
            },
            body: {
                currentPassword: 'currentpass123',
                newPassword: 'newpass123'
            },
            description: 'Update tenant password in tenant database'
        }
    }
};

/**
 * PROFILE RESPONSE EXAMPLES
 */
const profileResponseExamples = {
    
    landlordProfileResponse: {
        data: {
            id: 'landlord_user_id',
            email: 'admin@landlord.com',
            name: 'Landlord Admin',
            mobile: '+1234567890',
            address: {
                street: '123 Landlord Street',
                city: 'Landlord City',
                state: 'LC',
                zip: '12345'
            }
        },
        message: 'User profile fetched successfully'
    },

    tenantProfileResponse: {
        data: {
            id: 'tenant_user_id',
            email: 'john@acme.com',
            name: 'John Doe',
            mobile: '+1987654321',
            address: {
                street: '456 Tenant Avenue',
                city: 'Tenant City',
                state: 'TC',
                zip: '67890'
            }
        },
        message: 'User profile fetched successfully'
    },

    updateProfileResponse: {
        data: {
            id: 'user_id',
            email: 'updated@example.com',
            name: 'Updated Name',
            mobile: '+1111111111',
            address: {
                street: 'Updated Street',
                city: 'Updated City',
                state: 'US',
                zip: '11111'
            }
        },
        message: 'User profile updated successfully'
    },

    updatePasswordResponse: {
        data: null,
        statusCode: 200,
        message: 'Password updated successfully'
    }
};

/**
 * DATABASE STORAGE EXAMPLES
 */
const databaseStorageExamples = {
    
    landlordStorage: {
        userProfile: {
            database: 'master_database',
            collection: 'users',
            document: {
                _id: 'landlord_user_id',
                name: 'Landlord Admin',
                email: 'admin@landlord.com',
                mobile: '+1234567890',
                password: 'hashed_password',
                isActive: true,
                createdAt: '2024-09-08T...',
                updatedAt: '2024-09-08T...'
            }
        },
        userAddress: {
            database: 'master_database',
            collection: 'addresses',
            document: {
                _id: 'landlord_address_id',
                userId: 'landlord_user_id',
                street: '123 Landlord Street',
                city: 'Landlord City',
                state: 'LC',
                zip: '12345'
            }
        }
    },

    tenantStorage: {
        userProfile: {
            database: 'tenant_acme_database',
            collection: 'users',
            document: {
                _id: 'tenant_user_id',
                name: 'John Doe',
                email: 'john@acme.com',
                mobile: '+1987654321',
                password: 'hashed_password',
                isActive: true,
                createdAt: '2024-09-08T...',
                updatedAt: '2024-09-08T...'
            }
        },
        userAddress: {
            database: 'tenant_acme_database',
            collection: 'addresses',
            document: {
                _id: 'tenant_address_id',
                userId: 'tenant_user_id',
                street: '456 Tenant Avenue',
                city: 'Tenant City',
                state: 'TC',
                zip: '67890'
            }
        }
    }
};

/**
 * CURL EXAMPLES
 */
const curlExamples = `
# ===== LANDLORD PROFILE OPERATIONS =====

# 1. Get landlord profile
curl -X GET http://localhost:3000/profile \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer LANDLORD_ACCESS_TOKEN"

# 2. Update landlord profile
curl -X PATCH http://localhost:3000/profile \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer LANDLORD_ACCESS_TOKEN" \\
  -d '{
    "name": "Updated Landlord",
    "email": "newemail@landlord.com",
    "mobile": "+1234567890",
    "address": "123 New Street",
    "city": "New City",
    "state": "NC",
    "postalCode": "12345"
  }'

# 3. Update landlord password
curl -X PATCH http://localhost:3000/profile/password \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer LANDLORD_ACCESS_TOKEN" \\
  -d '{
    "currentPassword": "currentpass123",
    "newPassword": "newpass123"
  }'

# ===== TENANT PROFILE OPERATIONS =====

# 1. Get tenant profile
curl -X GET http://localhost:3000/profile \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer TENANT_ACCESS_TOKEN" \\
  -H "X-Tenant-Subdomain: acme"

# 2. Update tenant profile
curl -X PATCH http://localhost:3000/profile \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer TENANT_ACCESS_TOKEN" \\
  -H "X-Tenant-Subdomain: acme" \\
  -d '{
    "name": "Updated Tenant",
    "email": "newemail@acme.com",
    "mobile": "+1987654321",
    "address": "456 New Avenue",
    "city": "New Tenant City",
    "state": "TC",
    "postalCode": "67890"
  }'

# 3. Update tenant password
curl -X PATCH http://localhost:3000/profile/password \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer TENANT_ACCESS_TOKEN" \\
  -H "X-Tenant-Subdomain: acme" \\
  -d '{
    "currentPassword": "currentpass123",
    "newPassword": "newpass123"
  }'
`;

/**
 * VALIDATION AND SECURITY
 */
const validationAndSecurity = {
    
    tenantContextValidation: {
        description: 'All profile operations validate tenant context',
        implementation: 'validateTenantContext(req) - ensures database connection exists',
        landlordException: 'Landlord requests work without tenant connection'
    },

    emailUniqueness: {
        description: 'Email uniqueness is validated within each database context',
        landlordScope: 'Email uniqueness checked in master database for landlord',
        tenantScope: 'Email uniqueness checked in tenant database for tenant',
        isolation: 'Same email can exist in different tenant databases'
    },

    dataIsolation: {
        description: 'Complete isolation between landlord and tenant profile data',
        landlordAccess: 'Landlord profiles only accessible from master database',
        tenantAccess: 'Tenant profiles only accessible from respective tenant database',
        crossAccess: 'No cross-access between different tenant databases'
    },

    authenticationIntegration: {
        description: 'Profile operations work with JWT tokens containing context',
        tokenValidation: 'Authorization middleware validates JWT tokens',
        contextExtraction: 'Tenant middleware extracts context from headers and tokens',
        roleBasedAccess: 'Operations are context-aware based on user role'
    }
};

/**
 * IMPLEMENTATION HIGHLIGHTS
 */
const implementationHighlights = {
    
    repositoryPattern: {
        description: 'AddressRepository enhanced with multi-tenant support',
        constructor: 'AddressRepository(connection?) - accepts optional tenant connection',
        modelSelection: 'Uses TenantModelFactory for tenant connections, default Address model for master',
        contextAware: 'getAddressRepository(req) returns appropriate repository based on context'
    },

    serviceIntegration: {
        description: 'UserService overloaded methods support both contexts',
        getUserProfile: 'getUserProfile(userId) vs getUserProfile(connection, userId)',
        findById: 'findById(id) vs findById(connection, id)',
        update: 'update(id, data) vs update(connection, id, data)'
    },

    errorHandling: {
        description: 'Context-aware error handling and logging',
        contextLogging: 'getContextInfo(req) provides meaningful log context',
        errorMessages: 'Error messages include tenant/landlord context for debugging',
        validationErrors: 'Validation errors are scoped to appropriate database context'
    },

    middlewareIntegration: {
        description: 'Profile routes use optionalTenant middleware',
        authMiddleware: 'AuthMiddleware validates JWT tokens for all profile operations',
        tenantMiddleware: 'SimpleTenantMiddleware.optionalTenant allows both landlord and tenant',
        contextResolution: 'Middleware sets req.isLandlord and req.tenantConnection'
    }
};

/**
 * TESTING SCENARIOS
 */
const testingScenarios = {
    
    scenario1: {
        name: 'Landlord Profile Complete Flow',
        steps: [
            'Login as landlord to get access token',
            'Get landlord profile (no X-Tenant-Subdomain header)',
            'Update landlord profile with new information',
            'Update landlord password',
            'Verify all operations use master database'
        ]
    },

    scenario2: {
        name: 'Tenant Profile Complete Flow',
        steps: [
            'Login as tenant with X-Tenant-Subdomain header',
            'Get tenant profile with X-Tenant-Subdomain header',
            'Update tenant profile with new information',
            'Update tenant password',
            'Verify all operations use tenant database'
        ]
    },

    scenario3: {
        name: 'Email Uniqueness Validation',
        steps: [
            'Register landlord with email@example.com',
            'Register tenant in acme database with same email@example.com',
            'Verify both succeed (different database contexts)',
            'Try to update another landlord user with same email',
            'Verify update fails (same database context)'
        ]
    },

    scenario4: {
        name: 'Cross-Context Data Isolation',
        steps: [
            'Create landlord profile with specific data',
            'Create tenant profile with different data',
            'Verify landlord cannot access tenant profile data',
            'Verify tenant cannot access landlord profile data',
            'Confirm complete data isolation'
        ]
    }
};

export {
    profileOperationsByContext,
    profileRequestExamples,
    profileResponseExamples,
    databaseStorageExamples,
    curlExamples,
    validationAndSecurity,
    implementationHighlights,
    testingScenarios
};
