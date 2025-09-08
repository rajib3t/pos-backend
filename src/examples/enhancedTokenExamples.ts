/**
 * Enhanced Token System Examples - Landlord vs Tenant
 * 
 * This shows how the enhanced token system works with context information
 */

/**
 * ENHANCED TOKEN PAYLOAD STRUCTURE
 */
interface EnhancedTokenPayload {
    userId: string;
    email: string;
    context: 'landlord' | 'tenant';
    subdomain: string;
    tenantId: string | null;
    timestamp: number;
    iat?: number; // JWT issued at
    exp?: number; // JWT expiration
}

/**
 * ENHANCED LOGIN RESPONSE STRUCTURE
 */
interface EnhancedLoginResponse {
    data: {
        accessToken: string;
        refreshToken: string;
        user: {
            email: string;
            name: string;
            id: string;
            context: 'landlord' | 'tenant';
            subdomain: string;
            tenantId: string | null;
            tenantName: string;
            permissions: string[];
            loginTime: string;
        }
    };
    message: string;
}

/**
 * LANDLORD TOKEN EXAMPLES
 */
const landlordTokenExamples = {
    
    // Login request
    loginRequest: {
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

    // Enhanced token payload for landlord
    tokenPayload: {
        userId: '66f2a1b2c3d4e5f6a7b8c9d0',
        email: 'admin@landlord.com',
        context: 'landlord',
        subdomain: 'landlord',
        tenantId: null,
        timestamp: 1694123456789
    } as EnhancedTokenPayload,

    // Enhanced login response for landlord
    loginResponse: {
        data: {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            user: {
                email: 'admin@landlord.com',
                name: 'Landlord Admin',
                id: '66f2a1b2c3d4e5f6a7b8c9d0',
                context: 'landlord',
                subdomain: 'landlord',
                tenantId: null,
                tenantName: 'Landlord',
                permissions: ['admin', 'landlord'],
                loginTime: '2024-09-07T12:30:56.789Z'
            }
        },
        message: 'Login successful'
    } as EnhancedLoginResponse
};

/**
 * TENANT TOKEN EXAMPLES
 */
const tenantTokenExamples = {
    
    // Login request
    loginRequest: {
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

    // Enhanced token payload for tenant
    tokenPayload: {
        userId: '66f2a1b2c3d4e5f6a7b8c9d1',
        email: 'john@acme.com',
        context: 'tenant',
        subdomain: 'acme',
        tenantId: '66f2a1b2c3d4e5f6a7b8c9d2',
        timestamp: 1694123456789
    } as EnhancedTokenPayload,

    // Enhanced login response for tenant
    loginResponse: {
        data: {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            user: {
                email: 'john@acme.com',
                name: 'John Doe',
                id: '66f2a1b2c3d4e5f6a7b8c9d1',
                context: 'tenant',
                subdomain: 'acme',
                tenantId: '66f2a1b2c3d4e5f6a7b8c9d2',
                tenantName: 'Acme Corporation',
                permissions: ['tenant'],
                loginTime: '2024-09-07T12:30:56.789Z'
            }
        },
        message: 'Login successful'
    } as EnhancedLoginResponse
};

/**
 * TOKEN VERIFICATION EXAMPLES
 */
const tokenVerificationExamples = {
    
    // Decode landlord token
    decodedLandlordToken: {
        userId: '66f2a1b2c3d4e5f6a7b8c9d0',
        email: 'admin@landlord.com',
        context: 'landlord',
        subdomain: 'landlord',
        tenantId: null,
        timestamp: 1694123456789,
        iat: 1694123456,
        exp: 1694127056
    },

    // Decode tenant token
    decodedTenantToken: {
        userId: '66f2a1b2c3d4e5f6a7b8c9d1',
        email: 'john@acme.com',
        context: 'tenant',
        subdomain: 'acme',
        tenantId: '66f2a1b2c3d4e5f6a7b8c9d2',
        timestamp: 1694123456789,
        iat: 1694123456,
        exp: 1694127056
    }
};

/**
 * TOKEN REFRESH EXAMPLES
 */
const tokenRefreshExamples = {
    
    // Refresh landlord token
    refreshLandlordRequest: {
        method: 'POST',
        url: '/auth/refresh',
        headers: {
            'Content-Type': 'application/json'
        },
        cookies: {
            refreshToken: 'landlord_refresh_token_here'
        }
    },

    // Refresh tenant token
    refreshTenantRequest: {
        method: 'POST',
        url: '/auth/refresh',
        headers: {
            'Content-Type': 'application/json'
        },
        cookies: {
            refreshToken: 'tenant_refresh_token_here'
        }
    },

    // Refresh response (maintains original context)
    refreshResponse: {
        data: {
            accessToken: 'new_access_token_with_same_context',
            refreshToken: 'original_refresh_token'
        },
        message: 'Token refreshed successfully'
    }
};

/**
 * PRACTICAL USAGE EXAMPLES
 */
const usageExamples = {
    
    // Express.js middleware to extract token context
    extractTokenContext: `
    // Middleware to extract context from token
    const extractTokenContext = (req, res, next) => {
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                req.user = {
                    id: decoded.userId,
                    email: decoded.email,
                    context: decoded.context,
                    subdomain: decoded.subdomain,
                    tenantId: decoded.tenantId,
                    timestamp: decoded.timestamp
                };
                req.isLandlord = decoded.context === 'landlord';
                req.isTenant = decoded.context === 'tenant';
            } catch (error) {
                return res.status(401).json({ message: 'Invalid token' });
            }
        }
        next();
    };
    `,

    // Route protection based on context
    routeProtection: `
    // Protect landlord-only routes
    const requireLandlord = (req, res, next) => {
        if (!req.user || req.user.context !== 'landlord') {
            return res.status(403).json({ 
                message: 'Landlord access required' 
            });
        }
        next();
    };

    // Protect tenant-only routes
    const requireTenant = (req, res, next) => {
        if (!req.user || req.user.context !== 'tenant') {
            return res.status(403).json({ 
                message: 'Tenant access required' 
            });
        }
        next();
    };

    // Allow both but with context awareness
    const requireAuth = (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                message: 'Authentication required' 
            });
        }
        next();
    };
    `,

    // Frontend token handling
    frontendTokenHandling: `
    // Frontend: Store and use tokens with context
    class AuthService {
        login(credentials, subdomain = null) {
            const headers = { 'Content-Type': 'application/json' };
            if (subdomain) {
                headers['X-Tenant-Subdomain'] = subdomain;
            }
            
            return fetch('/auth/login', {
                method: 'POST',
                headers,
                body: JSON.stringify(credentials)
            })
            .then(response => response.json())
            .then(data => {
                localStorage.setItem('accessToken', data.data.accessToken);
                localStorage.setItem('userContext', JSON.stringify(data.data.user));
                return data;
            });
        }

        getAuthHeaders() {
            const token = localStorage.getItem('accessToken');
            const userContext = JSON.parse(localStorage.getItem('userContext') || '{}');
            
            const headers = {
                'Authorization': \`Bearer \${token}\`
            };
            
            // Add tenant header if user is tenant
            if (userContext.context === 'tenant' && userContext.subdomain !== 'landlord') {
                headers['X-Tenant-Subdomain'] = userContext.subdomain;
            }
            
            return headers;
        }

        isLandlord() {
            const userContext = JSON.parse(localStorage.getItem('userContext') || '{}');
            return userContext.context === 'landlord';
        }

        isTenant() {
            const userContext = JSON.parse(localStorage.getItem('userContext') || '{}');
            return userContext.context === 'tenant';
        }
    }
    `
};

/**
 * CURL EXAMPLES WITH ENHANCED TOKENS
 */
const curlExamples = `
# ===== LANDLORD LOGIN =====
curl -X POST http://localhost:3000/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "admin@landlord.com",
    "password": "password123"
  }'

# Response includes enhanced user context:
# {
#   "data": {
#     "accessToken": "eyJ...",
#     "refreshToken": "eyJ...",
#     "user": {
#       "email": "admin@landlord.com",
#       "name": "Admin",
#       "id": "user_id",
#       "context": "landlord",
#       "subdomain": "landlord", 
#       "tenantId": null,
#       "tenantName": "Landlord",
#       "permissions": ["admin", "landlord"],
#       "loginTime": "2024-09-07T12:30:56.789Z"
#     }
#   }
# }

# ===== TENANT LOGIN =====
curl -X POST http://localhost:3000/auth/login \\
  -H "Content-Type: application/json" \\
  -H "X-Tenant-Subdomain: acme" \\
  -d '{
    "email": "john@acme.com",
    "password": "password123"
  }'

# Response includes enhanced user context:
# {
#   "data": {
#     "accessToken": "eyJ...",
#     "refreshToken": "eyJ...",
#     "user": {
#       "email": "john@acme.com",
#       "name": "John Doe",
#       "id": "user_id",
#       "context": "tenant",
#       "subdomain": "acme",
#       "tenantId": "tenant_id",
#       "tenantName": "Acme Corporation",
#       "permissions": ["tenant"],
#       "loginTime": "2024-09-07T12:30:56.789Z"
#     }
#   }
# }

# ===== USE TOKEN IN SUBSEQUENT REQUESTS =====

# Landlord request (no X-Tenant-Subdomain needed)
curl -X GET http://localhost:3000/users \\
  -H "Authorization: Bearer LANDLORD_ACCESS_TOKEN"

# Tenant request (X-Tenant-Subdomain needed for consistency)
curl -X GET http://localhost:3000/users \\
  -H "Authorization: Bearer TENANT_ACCESS_TOKEN" \\
  -H "X-Tenant-Subdomain: acme"

# ===== TOKEN REFRESH =====
curl -X POST http://localhost:3000/auth/refresh \\
  -H "Content-Type: application/json" \\
  -H "Cookie: refreshToken=REFRESH_TOKEN_HERE"
`;

/**
 * ENHANCED TOKEN BENEFITS
 */
const enhancedTokenBenefits = {
    contextAwareness: 'Tokens now contain full context information (landlord/tenant)',
    securityImprovement: 'Enhanced payload makes token forgery more difficult',
    debuggingEasier: 'Timestamps and context help with debugging and logging',
    permissionManagement: 'Clear permission levels for different user types',
    multiTenancy: 'Full tenant isolation with secure token-based access',
    consistency: 'Token refresh maintains original context automatically',
    auditTrail: 'Login time and context provide better audit capabilities'
};

export {
    EnhancedTokenPayload,
    EnhancedLoginResponse,
    landlordTokenExamples,
    tenantTokenExamples,
    tokenVerificationExamples,
    tokenRefreshExamples,
    usageExamples,
    curlExamples,
    enhancedTokenBenefits
};
