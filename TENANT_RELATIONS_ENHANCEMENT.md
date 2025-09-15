# Tenant Service Relation Data Enhancement

## Overview
Enhanced the tenant service to include relation data (createdBy, updatedBy, settings) when fetching tenant data both for pagination and single record retrieval.

## Changes Made

### 1. Repository Layer Updates

#### `src/repositories/repository.ts`
- Added `populate` option to `PaginationOptions<TEntity>` interface
- Supports string, string array, or object array with path and select options

#### `src/repositories/base.repository.ts`
- Enhanced `findPaginated` method to support population of related fields
- Added logic to handle different populate option formats (string, string[], or object[])

### 2. Service Layer Updates

#### `src/services/tenant.service.ts`

**New Methods Added:**
- `findByIdWithRelations(id: string)` - Get single tenant with populated relations
- `findAllWithRelations()` - Get all tenants with populated relations

**Enhanced Methods:**
- `getTenantsWithPagination()` - Now automatically populates createdBy, updatedBy, and settings
- `getTenantBySubdomain()` - Now includes relation data in the response

**Default Population Configuration:**
```typescript
populate: [
    { path: 'createdBy', select: 'name email' },
    { path: 'updatedBy', select: 'name email' },
    { path: 'settings' }
]
```

### 3. Controller Layer Updates

#### `src/controllers/tenant.controller.ts`
- Updated `getTenant` method to use `findByIdWithRelations()`
- Updated `update` method to use `findByIdWithRelations()` for validation
- Updated `delete` method to use `findByIdWithRelations()` for validation
- Pagination endpoint automatically returns populated relation data

### 4. Example Usage

#### `src/examples/tenantRelationUsage.ts`
Created comprehensive examples showing:
- Paginated tenants with relations
- Single tenant retrieval with relations
- Tenant by subdomain with relations
- All tenants with relations
- Custom pagination with specific populate options

## API Response Changes

### Before:
```json
{
  "data": {
    "items": [
      {
        "_id": "tenant-id",
        "name": "Example Tenant",
        "subdomain": "example",
        "createdBy": "user-id",
        "updatedBy": "user-id"
      }
    ]
  }
}
```

### After:
```json
{
  "data": {
    "items": [
      {
        "_id": "tenant-id",
        "name": "Example Tenant",
        "subdomain": "example",
        "createdBy": {
          "_id": "user-id",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "updatedBy": {
          "_id": "user-id-2",
          "name": "Jane Doe", 
          "email": "jane@example.com"
        },
        "settings": {
          "_id": "setting-id",
          "settingData": "..."
        }
      }
    ]
  }
}
```

## Benefits

1. **Rich Data Context**: API consumers now get complete user information for createdBy/updatedBy fields
2. **Reduced API Calls**: No need for separate requests to fetch user details
3. **Flexible Population**: Custom populate options can be passed for specific use cases
4. **Backward Compatibility**: Existing code continues to work, with enhanced data returned
5. **Consistent Behavior**: All tenant retrieval methods now consistently return relation data

## Usage Examples

### Basic Pagination with Relations (Automatic)
```typescript
const result = await tenantService.getTenantsWithPagination({
    page: 1,
    limit: 10
});
// Relations are automatically populated
```

### Custom Population
```typescript
const result = await tenantService.getTenantsWithPagination({
    page: 1,
    limit: 10,
    populate: [
        { path: 'createdBy', select: 'name email mobile' },
        { path: 'updatedBy', select: 'name email' }
    ]
});
```

### Single Tenant with Relations
```typescript
const tenant = await tenantService.findByIdWithRelations('tenant-id');
console.log(tenant.createdBy.name); // User name available
```

## Migration Notes
- No breaking changes to existing APIs
- Enhanced data is returned automatically
- Existing client code will receive additional populated fields
- Database queries may be slightly slower due to joins, but provide richer data context