/**
 * Utility functions for handling dates and timezone conversions
 */

export interface DateFilterOptions {
    timezoneOffset?: number; // Client timezone offset in minutes
    isEndOfDay?: boolean;
}

export class DateUtils {
    /**
     * Parse a date string with timezone handling for database filters
     * @param dateString - Date string from client
     * @param options - Configuration options
     * @returns Date object adjusted for database querying (UTC)
     */
    static parseFilterDate(dateString: string, options: DateFilterOptions = {}): Date {
        const { timezoneOffset = 0, isEndOfDay = false } = options;
        
        // Check if the date string has timezone information
        // Look for 'T' (ISO format), 'Z' (UTC), or timezone offset patterns like '+05:30' or '-0530'
        const hasTimezoneInfo = dateString.includes('T') || 
                                dateString.includes('Z') || 
                                /[+-]\d{2}:?\d{2}$/.test(dateString); // Matches +05:30, +0530, -05:30, -0530
        
        if (hasTimezoneInfo) {
            // Date already has timezone info, use as is
            const date = new Date(dateString);
            if (isEndOfDay && !dateString.includes('T')) {
                date.setUTCHours(23, 59, 59, 999);
            }
            return date;
        }
        
        // For simple date strings like "2025-09-14"
        // Treat as date in user's timezone and convert to UTC range
        
        // Start with the date as UTC (this represents the date at 00:00 UTC)
        const utcDate = new Date(dateString + 'T00:00:00.000Z');
        
        if (isEndOfDay) {
            utcDate.setUTCHours(23, 59, 59, 999);
        }
        
        // Convert to represent the user's timezone
        // timezoneOffset is negative for timezones ahead of UTC
        // For GMT+5:30, offset = -330 minutes
        // User's "2025-09-14 00:00" in GMT+5:30 = "2025-09-13 18:30" in UTC
        // So we add the timezone offset to shift the date
        const adjustedDate = new Date(utcDate.getTime() + (timezoneOffset * 60 * 1000));
        
        return adjustedDate;
    }

    /**
     * Convert UTC date to local date string for display
     * @param utcDate - UTC Date from database
     * @param timezoneOffset - Client timezone offset in minutes  
     * @returns Date adjusted for display in client timezone
     */
    static toLocalDate(utcDate: Date, timezoneOffset: number = 0): Date {
        const localDate = new Date(utcDate);
        localDate.setMinutes(localDate.getMinutes() + timezoneOffset);
        return localDate;
    }

    /**
     * Get date range filter for MongoDB queries
     * @param fromDate - Start date string
     * @param toDate - End date string
     * @param timezoneOffset - Client timezone offset in minutes
     * @returns MongoDB date filter object
     */
    static getDateRangeFilter(
        fromDate?: string, 
        toDate?: string, 
        timezoneOffset: number = 0
    ): { $gte?: Date; $lte?: Date } | null {
        if (!fromDate && !toDate) {
            return null;
        }

        const filter: { $gte?: Date; $lte?: Date } = {};

        if (fromDate) {
            filter.$gte = this.parseFilterDate(fromDate, { timezoneOffset });
        }

        if (toDate) {
            filter.$lte = this.parseFilterDate(toDate, { 
                timezoneOffset, 
                isEndOfDay: true 
            });
        }

        return filter;
    }

    /**
     * Get client timezone offset from request headers or other sources
     * @param req - Express request object
     * @returns Timezone offset in minutes
     */
    static getTimezoneOffset(req: any): number {
        // Check query parameter first
        if (req.query.timezone) {
            return parseInt(req.query.timezone as string);
        }
        
        // Check headers for timezone info
        if (req.headers['x-timezone-offset']) {
            return parseInt(req.headers['x-timezone-offset'] as string);
        }
        
        // Default to UTC
        return 0;
    }

    /**
     * Format date for logging with timezone info
     * @param date - Date to format
     * @param label - Label for logging
     * @param originalString - Original date string from client
     * @param timezoneOffset - Timezone offset used
     * @returns Formatted log string
     */
    static formatDateLog(
        date: Date, 
        label: string, 
        originalString?: string, 
        timezoneOffset?: number
    ): string {
        const parts = [
            `${label}: ${date.toISOString()}`
        ];
        
        if (originalString) {
            parts.push(`Original: ${originalString}`);
        }
        
        if (timezoneOffset !== undefined) {
            parts.push(`TZ Offset: ${timezoneOffset}min`);
        }
        
        return parts.join(', ');
    }
}