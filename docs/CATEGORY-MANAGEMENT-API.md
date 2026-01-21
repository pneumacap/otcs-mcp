# Category Management API Research

This document summarizes the OpenText Content Server REST API capabilities for category management.

## Overview

Categories in OpenText Content Server are metadata templates that can be applied to documents, folders, and other nodes. They consist of:
- **Category Definition** - The template itself (node type 131)
- **Category Attributes** - Fields defined within the category (text, date, number, sets, etc.)
- **Applied Categories** - Instances of categories attached to documents/nodes with values

## API Capabilities

### What the REST API CAN Do

| Capability | API Endpoint | Notes |
|------------|--------------|-------|
| Create empty category node | `POST /v2/nodes` with `type=131` | Creates category container only |
| Apply category to node | `POST /v2/nodes/{id}/categories` | Attaches category with optional values |
| Update category values | `PUT /v2/nodes/{id}/categories/{cat_id}/` | Updates attribute values |
| Remove category from node | `DELETE /v2/nodes/{id}/categories/{cat_id}/` | Removes category instance |
| List categories on node | `GET /v2/nodes/{id}/categories` | Returns all applied categories |
| Get specific category | `GET /v2/nodes/{id}/categories/{cat_id}/` | Returns category with values |
| Get category form schema | `GET /v1/forms/nodes/categories/create` | Shows attribute structure |
| Browse Categories Volume | `GET /v2/nodes/{id}/nodes` | List categories (parent=2003) |

### What the REST API CANNOT Do

| Limitation | Details |
|------------|---------|
| Define category attributes | Attribute schema must be created via CS Admin UI |
| Modify category structure | Cannot add/remove/modify attribute definitions via API |
| Create attribute types | Text, Date, Integer, Set definitions require Admin UI |
| Set attribute constraints | Min/max values, required fields, etc. require Admin UI |

## Node Types Reference

| Type ID | Name | Description |
|---------|------|-------------|
| 131 | Category | Category definition node |
| 0 | Folder | Standard folder (can hold categories in Categories Volume) |

## Categories Volume

The Categories Volume is a system volume (typically node ID **2003**) that contains all category definitions. Categories can be organized in folders within this volume.

### Discovering the Categories Volume

```javascript
// Get all volumes
GET /v1/volumes

// Look for the Categories volume in the response
// Or directly access if you know the ID (typically 2003)
GET /v2/nodes/2003/nodes
```

## Creating a Category (Empty Container)

The REST API can create a category node, but it will be **empty** (no attributes defined):

```javascript
POST /v2/nodes
Content-Type: application/x-www-form-urlencoded

type=131
parent_id=2003  // Categories Volume
name=My New Category
description=Optional description
```

**Response:**
```json
{
  "results": {
    "data": {
      "properties": {
        "id": 12345,
        "name": "My New Category",
        "type": 131,
        "type_name": "Category"
      }
    }
  }
}
```

**Important:** This creates an empty category container. To add attributes (fields), you must use the Content Server Administration interface.

## Working with Category Attributes

### Attribute Key Format

Category attribute values use a specific key format:

| Format | Example | Description |
|--------|---------|-------------|
| Simple | `{cat_id}_{attr_id}` | `9830_2` - Category 9830, Attribute 2 |
| Set Row | `{cat_id}_{set_id}_{row}_{attr_id}` | `9830_3_1_4` - Set row format |
| Multi-value | Array of values | `["value1", "value2"]` |

### Getting Category Form Schema

To discover the attribute structure of a category:

```javascript
GET /v1/forms/nodes/categories/create?id={node_id}&category_id={cat_id}
```

Response includes:
- Attribute names, IDs, and types
- Required field indicators
- Default values
- Set/nested structure information
- Validation constraints

### Applying a Category with Values

```javascript
POST /v2/nodes/{node_id}/categories
Content-Type: application/x-www-form-urlencoded

category_id=9830
9830_2=My Text Value
9830_5=2024-01-15  // Date field
```

### Updating Category Values

```javascript
PUT /v2/nodes/{node_id}/categories/{category_id}/
Content-Type: application/x-www-form-urlencoded

9830_2=Updated Value
9830_3_1_4=Set Row Value
```

### Working with Sets (Nested Attributes)

Sets are groups of attributes that can have multiple rows:

```javascript
// Update set attributes (row 1)
PUT /v2/nodes/{node_id}/categories/{category_id}/

{category_id}_{set_id}_1_{attr_id}=Row 1 Value

// Update set attributes (row 2)
{category_id}_{set_id}_2_{attr_id}=Row 2 Value
```

## Current MCP Server Implementation

The OTCS MCP Server (`otcs-mcp`) currently supports:

### Implemented (via `otcs_categories` tool)

| Action | Description |
|--------|-------------|
| `list` | List all categories applied to a node |
| `get` | Get specific category with values |
| `add` | Apply a category to a node |
| `update` | Update category attribute values |
| `remove` | Remove a category from a node |
| `get_form` | Get category form schema |

### Not Implemented

| Feature | Reason |
|---------|--------|
| Create category definition | API limitation - requires Admin UI |
| Define attributes | API limitation - requires Admin UI |
| Create category folders | Can be added using existing `otcs_create_folder` |

## Recommendations for New Category Creation

Since the REST API cannot define category attributes, the workflow for creating new categories is:

### Option 1: Admin UI (Recommended)

1. Log into Content Server Administration
2. Navigate to Categories Volume
3. Create new category with attributes using the UI
4. Use MCP server to apply/manage category instances

### Option 2: Hybrid Approach

1. Use API to create empty category container:
   ```javascript
   POST /v2/nodes
   type=131
   parent_id=2003
   name=New Category
   ```
2. Use Admin UI to add attributes to the category
3. Use MCP server for ongoing category management

### Option 3: Future Enhancement

If OpenText adds REST API support for attribute definition, the MCP server could be extended with:

```javascript
// Hypothetical future tool
otcs_create_category_definition({
  parent_id: 2003,
  name: "Invoice Category",
  attributes: [
    { name: "Invoice Number", type: "string", required: true },
    { name: "Amount", type: "decimal", required: true },
    { name: "Due Date", type: "date" }
  ]
})
```

## API Endpoints Reference

### Categories on Nodes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v2/nodes/{id}/categories` | List categories |
| GET | `/v2/nodes/{id}/categories/{cat_id}/` | Get category |
| POST | `/v2/nodes/{id}/categories` | Add category |
| PUT | `/v2/nodes/{id}/categories/{cat_id}/` | Update category |
| DELETE | `/v2/nodes/{id}/categories/{cat_id}/` | Remove category |

### Category Forms

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/forms/nodes/categories/create` | Create form schema |
| GET | `/v1/forms/nodes/categories/update` | Update form schema |

### Category Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/nodes/{id}/categories/actions` | Available actions |
| GET | `/v1/nodes/{id}/categories/{cat_id}/actions` | Category-specific actions |

## Attribute Data Types

Categories support these attribute types (configured via Admin UI):

| Type | Description | API Value Format |
|------|-------------|-----------------|
| String | Text field | `"text value"` |
| Integer | Whole number | `123` |
| Date | Date value | `"2024-01-15"` |
| User | User ID reference | `1001` |
| Boolean | True/false | `true` or `false` |
| Set | Multi-row container | Nested row format |
| Multi-value | Multiple values | `["val1", "val2"]` |

## Conclusion

The OpenText Content Server REST API provides comprehensive support for **using** categories (applying, updating, removing) but **not** for **defining** categories (creating attribute schemas). Category definition remains an administrative function requiring the Content Server Admin interface.

For the OTCS MCP Server, this means:
- Full support for category operations on documents/nodes
- No API path to create category definitions programmatically
- Admins must pre-create category templates in Content Server
- The MCP server can then use those templates via the API

## References

- Content Server REST API 2.0.2 Specification
- OpenText Business Workspaces REST API v1/v2
- OTCS MCP Server Implementation (`src/client/otcs-client.ts`)
