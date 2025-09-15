# Enhanced Tenant API with Populate and Advanced Filtering

## Overview
The tenant API has been significantly enhanced to support flexible populate options and advanced filtering capabilities across all query methods. This allows for optimal performance by only loading the data you need, when you need it.

## Key Features

### 1. Flexible Populate Options
- **Automatic Population**: Default populate for common relations
- **Custom Population**: Specify exactly which fields and relations to populate
- **Nested Population**: Support for multi-level relation population
- **Performance Control**: Option to disable population for faster queries

### 2. Enhanced Filtering
- **Advanced Query Operators**: Support for MongoDB query operators (`$regex`, `$in`, `$gte`, etc.)
- **Text Search**: Case-insensitive search across multiple fields
- **Date Range Filtering**: Built-in date range support with timezone handling
- **Complex Logic**: Support for `$or`, `$and`, and other logical operators

### 3. Universal Support
- All query methods now support populate options
- Consistent interface across pagination, single records, and bulk operations

## API Endpoints

### 1. GET /tenants (Pagination with Enhanced Options)

#### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `page` | number | Page number (default: 1) | `page=2` |
| `limit` | number | Items per page (default: 10) | `limit=20` |
| `name` | string | Filter by tenant name (case-insensitive) | `name=company` |
| `subdomain` | string | Filter by subdomain (case-insensitive) | `subdomain=tech` |
| `sortField` | string | Field to sort by | `sortField=name` |
| `sortDirection` | string | Sort direction (asc/desc) | `sortDirection=asc` |
| `includeRelations` | boolean | Include related data (default: true) | `includeRelations=false` |
| `populate` | string/JSON | Custom populate options | See examples below |

#### Populate Options

##### Simple populate (comma-separated):
```
?populate=createdBy,updatedBy,settings
```

##### Advanced populate (JSON):
```
?populate=[{"path":"createdBy","select":"name email"},{"path":"settings"}]
```

##### Disable populate for performance:
```
?includeRelations=false
```

#### Filter Examples

##### Basic filtering:
```
GET /tenants?name=company&subdomain=tech&page=1&limit=10
```

##### Date range filtering:
```
GET /tenants?createdAtFrom=2025-01-01&createdAtTo=2025-12-31
```

##### Custom populate with filtering:
```
GET /tenants?name=tech&populate=[{"path":"createdBy","select":"name email mobile"}]
```

### 2. GET /tenants/:id (Single Tenant)

Automatically includes relation data by default.

#### Response with Relations:
```json
{
  "data": {
    "_id": "tenant-id",
    "name": "Tech Company",
    "subdomain": "techco",
    "createdBy": {
      "_id": "user-id",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "updatedBy": {
      "_id": "user-id-2",
      "name": "Jane Smith",
      "email": "jane@example.com"
    },
    "settings": {
      "_id": "setting-id",
      "theme": "dark",
      "language": "en"
    }
  }
}
```

## Service Layer Methods

### 1. Enhanced Pagination Method

```typescript
// Basic pagination with auto-populate
const result = await tenantService.getTenantsWithPagination({
    page: 1,
    limit: 10,
    sort: { createdAt: -1 }
});

// Custom populate options
const result = await tenantService.getTenantsWithPagination({
    page: 1,
    limit: 10,
    filter: {
        name: { $regex: 'tech', $options: 'i' }
    },
    populate: [
        { path: 'createdBy', select: 'name email' },
        { path: 'settings', select: 'theme language' }
    ]
});

// Advanced pagination method
const result = await tenantService.getTenantsWithAdvancedPagination(
    { name: { $regex: 'corp', $options: 'i' } }, // filter
    1, // page
    10, // limit
    { createdAt: -1 }, // sort
    [{ path: 'createdBy', select: 'name email' }] // populate
);
```

### 2. Flexible Single Record Methods

```typescript
// Get tenant by ID without relations (faster)
const tenant = await tenantService.findById('tenant-id');

// Get tenant by ID with relations
const tenant = await tenantService.findByIdWithRelations('tenant-id');

// Get tenant by ID with custom populate
const tenant = await tenantService.findById('tenant-id', {
    populate: [{ path: 'createdBy', select: 'name' }]
});
```

### 3. Enhanced Bulk Operations

```typescript
// Get all tenants without relations (faster)
const tenants = await tenantService.findAll();

// Get all tenants with relations
const tenants = await tenantService.findAllWithRelations();

// Get all tenants with custom populate
const tenants = await tenantService.findAll({
    populate: [{ path: 'createdBy', select: 'name email' }]
});
```

### 4. Subdomain Lookup with Options

```typescript
// Get tenant by subdomain with relations (default)
const tenant = await tenantService.getTenantBySubdomain('techco');

// Get tenant by subdomain without relations
const tenant = await tenantService.getTenantBySubdomain('techco', false);
```

## Repository Layer Enhancements

### New Query Options Interface

```typescript
interface QueryOptions {
    populate?: string | string[] | { path: string; select?: string; populate?: any }[];
    projection?: Record<string, 0 | 1>;
    lean?: boolean; // Default: true for better performance
}
```

### Enhanced Base Repository Methods

```typescript
// Find all with options
findAll(options?: QueryOptions): Promise<TEntity[]>

// Find by ID with options  
findById(id: string, options?: QueryOptions): Promise<TEntity | null>

// Find one with filter and options
findOne(filter: FilterQuery, options?: QueryOptions): Promise<TEntity | null>

// Find many with filter and options
findMany(filter: FilterQuery, options?: QueryOptions & { sort?: any; limit?: number }): Promise<TEntity[]>

// Enhanced pagination
findPaginated(options?: PaginationOptions<TEntity>): Promise<PaginatedResult<TEntity>>
```

## Advanced Filtering Examples

### 1. Text Search Across Multiple Fields

```typescript
const result = await tenantService.getTenantsWithPagination({
    filter: {
        $or: [
            { name: { $regex: 'tech|corp|enterprise', $options: 'i' } },
            { subdomain: { $regex: 'pro|business', $options: 'i' } }
        ]
    }
});
```

### 2. Date Range Filtering

```typescript
const result = await tenantService.getTenantsWithPagination({
    filter: {
        createdAt: {
            $gte: new Date('2025-01-01'),
            $lte: new Date('2025-12-31')
        }
    }
});
```

### 3. Complex Filtering with Exclusions

```typescript
const result = await tenantService.getTenantsWithPagination({
    filter: {
        name: { $regex: 'company', $options: 'i' },
        subdomain: { $nin: ['test', 'demo', 'staging'] },
        createdAt: { $gte: new Date('2025-01-01') }
    }
});
```

### 4. Nested Population

```typescript
const result = await tenantService.getTenantsWithPagination({
    populate: [
        {
            path: 'settings',
            populate: {
                path: 'category',
                select: 'name description'
            }
        },
        { path: 'createdBy', select: 'name email' }
    ]
});
```

## Performance Considerations

### 1. When to Use Populate

✅ **Use populate when:**
- You need user names/emails for display
- Building detailed views or reports
- Showing related data in UI components

❌ **Avoid populate when:**
- Processing large datasets
- Only need IDs for further queries
- Building high-performance APIs

### 2. Performance Tips

```typescript
// Fast: No populate, only IDs
const tenants = await tenantService.getTenantsWithPagination({
    populate: []
});

// Balanced: Populate only needed fields
const tenants = await tenantService.getTenantsWithPagination({
    populate: [{ path: 'createdBy', select: 'name' }]
});

// Slower: Full populate with all relations
const tenants = await tenantService.findAllWithRelations();
```

### 3. Projection for Better Performance

```typescript
// Only select specific fields
const result = await tenantService.getTenantsWithPagination({
    projection: { name: 1, subdomain: 1, createdBy: 1 },
    populate: [{ path: 'createdBy', select: 'name' }]
});
```

## Migration Guide

### From Old API to Enhanced API

#### Before:
```typescript
// Limited functionality
const tenants = await tenantService.getTenantsWithPagination({
    page: 1,
    limit: 10
});
```

#### After:
```typescript
// Enhanced with flexible options
const tenants = await tenantService.getTenantsWithPagination({
    page: 1,
    limit: 10,
    filter: { name: { $regex: 'tech', $options: 'i' } },
    populate: [{ path: 'createdBy', select: 'name email' }],
    sort: { name: 1 }
});
```

## Error Handling

The enhanced API maintains robust error handling:

```typescript
try {
    const result = await tenantService.getTenantsWithPagination(options);
} catch (error) {
    // Handles populate errors, filter errors, and database connection issues
    console.error('Pagination error:', error.message);
}
```

## Best Practices

1. **Default Relations**: Use auto-populate for most UI scenarios
2. **Performance Critical**: Disable populate for bulk operations
3. **Custom Needs**: Use specific populate options for special requirements
4. **Filtering**: Leverage MongoDB operators for powerful queries
5. **Pagination**: Always use pagination for large datasets
6. **Error Handling**: Wrap queries in try-catch blocks

This enhanced tenant API provides the flexibility and performance needed for modern applications while maintaining backward compatibility.