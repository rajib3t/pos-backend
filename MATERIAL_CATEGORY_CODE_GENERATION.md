# Material Category Code Auto-Generation

## Overview
This document describes the automatic code generation feature for Material Categories based on Store name and Category name.

## Implementation Details

### Code Generation Logic
The `generateCode` method automatically creates a unique code for material categories using the following format:

**Format:** `[STORE_PREFIX][CATEGORY_PREFIX][NUMBER]`

- **STORE_PREFIX**: First 3 letters of the store name (uppercase, non-alphabetic characters removed)
- **CATEGORY_PREFIX**: First 3 letters of the category name (uppercase, non-alphabetic characters removed)
- **NUMBER**: 3-digit sequential number (001-999)

### Examples

| Store Name | Category Name | Generated Code |
|------------|--------------|----------------|
| Main Store | Food Items | MAIFOO001 |
| Main Store | Food Items | MAIFOO002 (if MAIFOO001 exists) |
| ABC Warehouse | Beverages | ABCBEV001 |
| XY Store | AB Category | XYXABC001 (padded with X) |

### Features

1. **Automatic Generation**: If no code is provided in the request, the system automatically generates one
2. **Manual Override**: Users can still provide a custom code if desired
3. **Uniqueness Check**: The system checks the database to ensure the generated code is unique per store
4. **Sequential Numbering**: If a code already exists, it increments the number (001 → 002 → 003, etc.)
5. **Padding**: Short names are padded with 'X' to maintain consistent length
6. **Error Handling**: Prevents infinite loops by limiting attempts to 999

### API Changes

#### Create Material Category Endpoint
**POST** `/:storeID/material-category`

**Request Body:**
```json
{
  "name": "Food Items",
  "code": "CUSTOM001"  // Optional - will auto-generate if not provided
}
```

**Response:**
```json
{
  "success": true,
  "message": "Material category created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Food Items",
    "code": "MAIFOO001",  // Auto-generated
    "store": "507f191e810c19729de860ea",
    "createdBy": "507f191e810c19729de860eb",
    "createdAt": "2025-10-03T10:00:00.000Z",
    "updatedAt": "2025-10-03T10:00:00.000Z"
  }
}
```

### Code Flow

1. **Request Received**: User creates a new material category
2. **Validation**: Request is validated (name is required, code is optional)
3. **Store Lookup**: System fetches store details to get the store name
4. **Code Generation** (if not provided):
   - Extract store name prefix (first 3 letters)
   - Extract category name prefix (first 3 letters)
   - Combine prefixes and add sequential number
   - Check database for uniqueness
   - Increment number if needed until unique code is found
5. **Category Creation**: Create the material category with the code
6. **Response**: Return the created category with the generated code

### Database Schema

The code field has a compound unique index with the store field:
```typescript
MaterialCategorySchema.index(
    { code: 1, store: 1 }, 
    { unique: true, name: 'unique_code_per_store' }
);
```

This ensures that codes are unique per store, but different stores can have the same code.

### Error Handling

- **Store Not Found**: Returns 404 if the specified store doesn't exist
- **Duplicate Code**: Returns 409 if a manually provided code already exists
- **Generation Failure**: Returns 500 if unable to generate a unique code after 999 attempts
- **Validation Errors**: Returns 400 for invalid request data

### Updated Files

1. **Controller**: `src/controllers/tenants/stores/material-category.controller.ts`
   - Added `StoreService` dependency
   - Implemented `generateCode` method
   - Updated `create` method to auto-generate code

2. **Validator**: `src/validators/material-category.validator.ts`
   - Made `code` field optional in the schema

### Benefits

1. **User Convenience**: No need to manually create codes
2. **Consistency**: All codes follow a standardized format
3. **Uniqueness**: Guaranteed unique codes per store
4. **Flexibility**: Can still provide custom codes if needed
5. **Traceability**: Code format clearly indicates store and category relationship

### Testing Recommendations

1. Test with various store and category name combinations
2. Test with short names (< 3 characters)
3. Test with names containing special characters
4. Test sequential code generation (create multiple categories with same base)
5. Test manual code override
6. Test duplicate code error handling
7. Test with non-existent store ID
8. Test concurrent requests to ensure no duplicate codes

### Future Enhancements

- Configurable code format (allow customization of prefix length, number padding, etc.)
- Code prefix templates per tenant
- Bulk code generation for migration scenarios
- Code recycling for deleted categories (optional)
