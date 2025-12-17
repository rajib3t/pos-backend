/**
 * Material Category Code Auto-Generation Example
 * 
 * This example demonstrates how the material category code is automatically generated
 * based on store name and category name.
 */

// Example scenarios for code generation

interface CodeGenerationExample {
    storeName: string;
    categoryName: string;
    expectedCode: string;
    notes?: string;
}

const examples: CodeGenerationExample[] = [
    {
        storeName: "Main Store",
        categoryName: "Food Items",
        expectedCode: "MAIFOO001",
        notes: "First 3 letters from 'MAIn' + first 3 from 'FOOd' + 001"
    },
    {
        storeName: "Main Store",
        categoryName: "Food Items",
        expectedCode: "MAIFOO002",
        notes: "If MAIFOO001 already exists, increment to 002"
    },
    {
        storeName: "ABC Warehouse",
        categoryName: "Beverages",
        expectedCode: "ABCBEV001",
        notes: "ABC + BEV + 001"
    },
    {
        storeName: "Downtown Shop",
        categoryName: "Electronics",
        expectedCode: "DOWELE001",
        notes: "DOWntown + ELEctronics + 001"
    },
    {
        storeName: "XY Store",
        categoryName: "AB Category",
        expectedCode: "XYXABX001",
        notes: "XYX (padded with X) + ABX (padded with X) + 001"
    },
    {
        storeName: "Store-123",
        categoryName: "Cat@gory",
        expectedCode: "STOCAT001",
        notes: "Special characters are removed: STO + CAT + 001"
    },
    {
        storeName: "Super Mega Store",
        categoryName: "Kitchen Appliances",
        expectedCode: "SUPKIT001",
        notes: "SUPer + KITchen + 001"
    }
];

/**
 * API Request Examples
 */

// Example 1: Auto-generate code (code not provided)
const autoGenerateRequest = {
    method: "POST",
    url: "/api/:storeID/material-category",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer <token>"
    },
    body: {
        name: "Food Items"
        // code is NOT provided - will be auto-generated
    },
    expectedResponse: {
        success: true,
        message: "Material category created successfully",
        data: {
            _id: "507f1f77bcf86cd799439011",
            name: "Food Items",
            code: "MAIFOO001", // Auto-generated
            store: "507f191e810c19729de860ea",
            createdBy: "507f191e810c19729de860eb",
            createdAt: "2025-10-03T10:00:00.000Z",
            updatedAt: "2025-10-03T10:00:00.000Z"
        }
    }
};

// Example 2: Manual code override (code provided)
const manualCodeRequest = {
    method: "POST",
    url: "/api/:storeID/material-category",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer <token>"
    },
    body: {
        name: "Food Items",
        code: "CUSTOM001" // Manually provided code
    },
    expectedResponse: {
        success: true,
        message: "Material category created successfully",
        data: {
            _id: "507f1f77bcf86cd799439011",
            name: "Food Items",
            code: "CUSTOM001", // Uses the provided code
            store: "507f191e810c19729de860ea",
            createdBy: "507f191e810c19729de860eb",
            createdAt: "2025-10-03T10:00:00.000Z",
            updatedAt: "2025-10-03T10:00:00.000Z"
        }
    }
};

// Example 3: Duplicate code error
const duplicateCodeError = {
    method: "POST",
    url: "/api/:storeID/material-category",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer <token>"
    },
    body: {
        name: "Food Items",
        code: "MAIFOO001" // Code already exists
    },
    expectedResponse: {
        success: false,
        message: "Validation failed",
        statusCode: 409,
        details: [
            "code: Code is already in use"
        ]
    }
};

/**
 * Code Generation Algorithm Explained
 * 
 * Step 1: Extract store name prefix
 * - Remove all non-alphabetic characters
 * - Take first 3 characters
 * - Convert to uppercase
 * - Pad with 'X' if less than 3 characters
 * 
 * Example: "Main Store" → "MAIN" → "MAI"
 * Example: "XY" → "XY" → "XYX" (padded)
 * 
 * Step 2: Extract category name prefix
 * - Same process as store name
 * 
 * Example: "Food Items" → "FOODITEMS" → "FOO"
 * 
 * Step 3: Combine and add sequential number
 * - Base code = storePrefix + categoryPrefix
 * - Add 3-digit sequential number starting from 001
 * 
 * Example: "MAI" + "FOO" → "MAIFOO" → "MAIFOO001"
 * 
 * Step 4: Check uniqueness
 * - Query database for existing code in the same store
 * - If exists, increment number: 001 → 002 → 003, etc.
 * - Maximum 999 attempts
 * 
 * Step 5: Return unique code
 */

/**
 * Testing Scenarios
 */
const testScenarios = [
    {
        scenario: "Normal case with standard names",
        storeId: "507f191e810c19729de860ea",
        storeName: "Main Store",
        requests: [
            { name: "Food Items" },      // Expected: MAIFOO001
            { name: "Beverages" },        // Expected: MAIBEV001
            { name: "Food Items" },       // Expected: MAIFOO002 (duplicate name, same store)
        ]
    },
    {
        scenario: "Short names (less than 3 characters)",
        storeId: "507f191e810c19729de860eb",
        storeName: "XY",
        requests: [
            { name: "AB" },               // Expected: XYXABX001 (both padded)
        ]
    },
    {
        scenario: "Names with special characters",
        storeId: "507f191e810c19729de860ec",
        storeName: "Store-123",
        requests: [
            { name: "Cat@gory#1" },       // Expected: STOCAT001
        ]
    },
    {
        scenario: "Manual code override",
        storeId: "507f191e810c19729de860ed",
        storeName: "Main Store",
        requests: [
            { name: "Food Items", code: "CUSTOM001" },  // Uses CUSTOM001
            { name: "Beverages" },                       // Expected: MAIBEV001
        ]
    },
    {
        scenario: "Sequential numbering",
        storeId: "507f191e810c19729de860ee",
        storeName: "Test Store",
        requests: [
            { name: "Category A" },       // Expected: TESCAT001
            { name: "Category A" },       // Expected: TESCAT002
            { name: "Category A" },       // Expected: TESCAT003
        ]
    }
];

/**
 * Usage in cURL
 */
const curlExamples = {
    autoGenerate: `
curl -X POST \\
  'http://localhost:3000/api/507f191e810c19729de860ea/material-category' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_TOKEN' \\
  -d '{
    "name": "Food Items"
  }'
    `,
    manualCode: `
curl -X POST \\
  'http://localhost:3000/api/507f191e810c19729de860ea/material-category' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_TOKEN' \\
  -d '{
    "name": "Food Items",
    "code": "CUSTOM001"
  }'
    `
};

export {
    examples,
    autoGenerateRequest,
    manualCodeRequest,
    duplicateCodeError,
    testScenarios,
    curlExamples
};
