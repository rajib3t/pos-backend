import { Request } from 'express';
import { SubdomainExtractor, DomainUtils } from './domain';

/**
 * Example usage of SubdomainExtractor utility
 * This file demonstrates how to use the subdomain extraction functionality
 */

// Example 1: Basic subdomain extraction
export function basicSubdomainExtraction(req: Request) {
    // Extract subdomain from request
    const subdomain = SubdomainExtractor.extractSubdomain(req);
    
    if (subdomain) {
        console.log(`Found subdomain: ${subdomain}`);
        return subdomain;
    } else {
        console.log('No valid subdomain found');
        return null;
    }
}

// Example 2: Check if subdomain exists
export function checkSubdomainExists(req: Request): boolean {
    const hasSubdomain = SubdomainExtractor.hasSubdomain(req);
    console.log(`Has subdomain: ${hasSubdomain}`);
    return hasSubdomain;
}

// Example 3: Get detailed subdomain information
export function getDetailedSubdomainInfo(req: Request) {
    const info = SubdomainExtractor.getSubdomainInfo(req);
    
    console.log('Subdomain Information:', {
        subdomain: info.subdomain,
        hasSubdomain: info.hasSubdomain,
        source: info.source,
        isValid: info.isValid,
        host: info.host,
        clientUrl: info.clientUrl
    });
    
    return info;
}

// Example 4: Using shorthand utilities
export function useShorthandUtils(req: Request) {
    // Quick extraction
    const subdomain = DomainUtils.getSubdomain(req);
    
    // Quick check
    const hasSubdomain = DomainUtils.hasSubdomain(req);
    
    // Full info
    const domainInfo = DomainUtils.getDomainInfo(req);
    
    return { subdomain, hasSubdomain, domainInfo };
}

// Example 5: Middleware usage
export const subdomainMiddleware = SubdomainExtractor.middleware({
    required: true, // Require subdomain to be present
    attachToRequest: true, // Attach subdomain info to request object
    onError: (req, error) => {
        console.error('Subdomain extraction error:', error);
    }
});

// Example 6: Optional subdomain middleware
export const optionalSubdomainMiddleware = SubdomainExtractor.middleware({
    required: false,
    attachToRequest: true
});

// Example 7: Testing with your specific headers
export function testWithYourHeaders() {
    // Simulate your request headers
    const mockRequest = {
        headers: {
            'host': 'localhost:8087',
            'x-tenant-subdomain': 'lead',
            'x-client-url': 'lead.mypos.local',
            'origin': 'http://lead.mypos.local',
            'referer': 'http://lead.mypos.local/'
        }
    } as Request;

    console.log('Testing with your headers:');
    
    // Test extraction
    const subdomain = SubdomainExtractor.extractSubdomain(mockRequest);
    console.log(`Extracted subdomain: ${subdomain}`); // Should return 'lead'
    
    // Test detailed info
    const info = SubdomainExtractor.getSubdomainInfo(mockRequest);
    console.log('Detailed info:', info);
    
    return { subdomain, info };
}

// Example 8: Express route usage
export function exampleRouteHandler(req: Request, res: any) {
    try {
        // Extract subdomain
        const subdomain = SubdomainExtractor.extractSubdomain(req);
        
        if (!subdomain) {
            return res.status(400).json({
                success: false,
                message: 'Subdomain is required',
                code: 'SUBDOMAIN_MISSING'
            });
        }

        // Use subdomain in your business logic
        console.log(`Processing request for tenant: ${subdomain}`);
        
        return res.json({
            success: true,
            message: `Welcome to ${subdomain} tenant`,
            data: {
                subdomain,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error processing request',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}

// Example 9: Conditional logic based on subdomain
export function conditionalLogicExample(req: Request) {
    const subdomain = SubdomainExtractor.extractSubdomain(req);
    
    if (!subdomain) {
        return { type: 'main-site', config: 'default' };
    }
    
    // Different logic for different subdomains
    switch (subdomain) {
        case 'lead':
            return { type: 'lead-management', config: 'lead-specific' };
        case 'sales':
            return { type: 'sales-management', config: 'sales-specific' };
        case 'admin':
            return { type: 'admin-panel', config: 'admin-specific' };
        default:
            return { type: 'tenant', config: 'tenant-specific', tenant: subdomain };
    }
}

// Example 10: Integration with existing tenant system
export function integrateTenantSystem(req: Request) {
    const subdomainInfo = SubdomainExtractor.getSubdomainInfo(req);
    
    if (!subdomainInfo.hasSubdomain) {
        throw new Error('Tenant subdomain is required for this operation');
    }
    
    // Your existing tenant lookup logic
    return {
        subdomain: subdomainInfo.subdomain,
        source: subdomainInfo.source,
        // Add your tenant-specific data here
        tenantId: `tenant_${subdomainInfo.subdomain}`,
        isValid: subdomainInfo.isValid
    };
}
