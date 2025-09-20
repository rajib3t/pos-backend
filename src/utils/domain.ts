import { Request } from 'express';

/**
 * Utility class for extracting and validating subdomains from HTTP requests
 * Supports multiple extraction methods and validation patterns
 */
export class SubdomainExtractor {
    private static readonly SUBDOMAIN_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    private static readonly RESERVED_SUBDOMAINS = [
        'www', 'api', 'admin', 'mail', 'ftp', 'localhost', 'test', 'staging', 'dev'
    ];

    /**
     * Extract subdomain from request headers using multiple fallback methods
     * @param req Express request object
     * @returns Subdomain string if found and valid, null otherwise
     */
    static extractSubdomain(req: Request): string | null {
        // Method 1: Check x-tenant-subdomain header (primary method)
        const headerSubdomain = req.headers['x-tenant-subdomain'] as string;
        if (headerSubdomain && this.isValidSubdomain(headerSubdomain)) {
            return headerSubdomain.toLowerCase();
        }

        // Method 2: Extract from x-client-url header
        const clientUrl = req.headers['x-client-url'] as string;
        if (clientUrl) {
            const urlSubdomain = this.extractFromUrl(clientUrl);
            if (urlSubdomain && this.isValidSubdomain(urlSubdomain)) {
                return urlSubdomain.toLowerCase();
            }
        }

        // Method 3: Extract from Host header
        const host = req.headers.host;
        if (host) {
            const hostSubdomain = this.extractFromHost(host);
            if (hostSubdomain && this.isValidSubdomain(hostSubdomain)) {
                return hostSubdomain.toLowerCase();
            }
        }

        // Method 4: Extract from Origin header
        const origin = req.headers.origin;
        if (origin) {
            const originSubdomain = this.extractFromUrl(origin);
            if (originSubdomain && this.isValidSubdomain(originSubdomain)) {
                return originSubdomain.toLowerCase();
            }
        }

        // Method 5: Extract from Referer header
        const referer = req.headers.referer;
        if (referer) {
            const refererSubdomain = this.extractFromUrl(referer);
            if (refererSubdomain && this.isValidSubdomain(refererSubdomain)) {
                return refererSubdomain.toLowerCase();
            }
        }

        return null;
    }

    /**
     * Check if subdomain exists in request headers
     * @param req Express request object
     * @returns boolean indicating if subdomain is present
     */
    static hasSubdomain(req: Request): boolean {
        return this.extractSubdomain(req) !== null;
    }

    /**
     * Extract subdomain from URL string
     * @param url URL string to parse
     * @returns Subdomain if found, null otherwise
     */
    private static extractFromUrl(url: string): string | null {
        try {
            // Handle URLs without protocol
            const urlToParse = url.startsWith('http') ? url : `http://${url}`;
            const parsedUrl = new URL(urlToParse);
            return this.extractFromHost(parsedUrl.hostname);
        } catch (error) {
            return null;
        }
    }

    /**
     * Extract subdomain from hostname
     * @param hostname Hostname to parse
     * @returns Subdomain if found, null otherwise
     */
    private static extractFromHost(hostname: string): string | null {
        if (!hostname) return null;

        // Remove port if present
        const cleanHostname = hostname.split(':')[0];
        
        // Split by dots
        const parts = cleanHostname.split('.');
        
        // Need at least 3 parts for subdomain (subdomain.domain.tld)
        if (parts.length < 3) return null;

        // First part is the subdomain
        const subdomain = parts[0];
        
        // Skip if it's a reserved subdomain or localhost
        if (this.RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase()) || 
            cleanHostname.includes('localhost')) {
            return null;
        }

        return subdomain;
    }

    /**
     * Validate subdomain format
     * @param subdomain Subdomain to validate
     * @returns boolean indicating if subdomain is valid
     */
    private static isValidSubdomain(subdomain: string): boolean {
        if (!subdomain || subdomain.length === 0) return false;
        if (subdomain.length > 63) return false; // RFC 1035 limit
        if (this.RESERVED_SUBDOMAINS.includes(subdomain.toLowerCase())) return false;
        
        return this.SUBDOMAIN_PATTERN.test(subdomain);
    }

    /**
     * Get detailed subdomain information from request
     * @param req Express request object
     * @returns Object with subdomain details
     */
    static getSubdomainInfo(req: Request): {
        subdomain: string | null;
        hasSubdomain: boolean;
        source: string | null;
        isValid: boolean;
        host: string | null;
        clientUrl: string | null;
    } {
        const subdomain = this.extractSubdomain(req);
        const host = req.headers.host || null;
        const clientUrl = req.headers['x-client-url'] as string || null;
        
        let source: string | null = null;
        
        // Determine the source of subdomain extraction
        if (req.headers['x-tenant-subdomain']) {
            source = 'x-tenant-subdomain';
        } else if (req.headers['x-client-url']) {
            source = 'x-client-url';
        } else if (req.headers.host) {
            source = 'host';
        } else if (req.headers.origin) {
            source = 'origin';
        } else if (req.headers.referer) {
            source = 'referer';
        }

        return {
            subdomain,
            hasSubdomain: subdomain !== null,
            source,
            isValid: subdomain ? this.isValidSubdomain(subdomain) : false,
            host,
            clientUrl
        };
    }

    /**
     * Middleware factory for subdomain extraction
     * @param options Configuration options
     * @returns Express middleware function
     */
    static middleware(options: {
        required?: boolean;
        attachToRequest?: boolean;
        onError?: (req: Request, error: string) => void;
    } = {}) {
        return (req: any, res: any, next: any) => {
            try {
                const subdomainInfo = this.getSubdomainInfo(req);
                
                if (options.attachToRequest) {
                    req.subdomain = subdomainInfo.subdomain;
                    req.subdomainInfo = subdomainInfo;
                }

                if (options.required && !subdomainInfo.hasSubdomain) {
                    const error = 'Subdomain is required but not found in request';
                    if (options.onError) {
                        options.onError(req, error);
                    }
                    return res.status(400).json({
                        success: false,
                        message: error,
                        code: 'SUBDOMAIN_REQUIRED'
                    });
                }

                next();
            } catch (error) {
                const errorMessage = 'Error extracting subdomain from request';
                if (options.onError) {
                    options.onError(req, errorMessage);
                }
                return res.status(500).json({
                    success: false,
                    message: errorMessage,
                    code: 'SUBDOMAIN_EXTRACTION_ERROR'
                });
            }
        };
    }
}

/**
 * Quick utility functions for common use cases
 */
export const DomainUtils = {
    /**
     * Extract subdomain from request (shorthand)
     */
    getSubdomain: (req: Request): string | null => {
        return SubdomainExtractor.extractSubdomain(req);
    },

    /**
     * Check if request has valid subdomain (shorthand)
     */
    hasSubdomain: (req: Request): boolean => {
        return SubdomainExtractor.hasSubdomain(req);
    },

    /**
     * Get full domain info (shorthand)
     */
    getDomainInfo: (req: Request) => {
        return SubdomainExtractor.getSubdomainInfo(req);
    }
};

// Export default for convenience
export default SubdomainExtractor;