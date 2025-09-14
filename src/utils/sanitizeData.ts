class DataSanitizer{



    public static sanitizeData = <T extends Record<string, any>>(data: T, sensitiveFields: string[]) => {
        if (Array.isArray(data)) {
            return data.map(item => {
                const sanitized = { ...item } as Record<string, any>;
                sensitiveFields.forEach(field => delete sanitized[field]);
                return sanitized;
            });
        } else {
            const sanitized = { ...data } as Record<string, any>;
            sensitiveFields.forEach(field => delete sanitized[field]);
            return sanitized;
        }
    }
}



export default DataSanitizer;