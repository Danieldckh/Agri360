# Agri4All API v1 — Implementation Guide

A practical, step-by-step guide for learning and testing the Agri4All REST API. Follow the sections in order — each one builds on the previous.

> **Base URL for all examples:** `https://alpha.agri4all.com/api/v1`
>
> **Interactive API docs:** `https://alpha.agri4all.com/docs/api` (requires login)

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Getting Started](#2-getting-started)
3. [Understanding the Basics](#3-understanding-the-basics)
4. [Working with Your Profile](#4-working-with-your-profile)
5. [Browsing the Marketplace](#5-browsing-the-marketplace)
6. [Managing Products (CRUD)](#6-managing-products-crud)
7. [Product Sub-resources](#7-product-sub-resources)
8. [Idempotency](#8-idempotency)
9. [Acting as an Agent](#9-acting-as-an-agent)
10. [Quick Reference](#10-quick-reference)

---

## 1. Introduction

### What is this API?

The Agri4All API lets external applications — including AI agents — interact with the Agri4All agricultural marketplace programmatically. Instead of clicking through the website, you send HTTP requests and receive JSON responses.

### What can you do with it?

- **Browse** categories, products, and user profiles (no login required)
- **Search** products with filters (category, country, price range, geolocation)
- **Create and manage** product listings (requires login + paid subscription)
- **Upload** product images and documents
- **Manage** your user profile and avatar
- **Act on behalf of sellers** (agent accounts only)

### How authentication works

The API uses **Bearer token** authentication (via Laravel Sanctum):

1. You **login** with email + password and receive a token
2. You **include that token** in every subsequent request as a header: `Authorization: Bearer <your-token>`
3. The token has **abilities** (permissions) that determine what you can do
4. The token **expires** after 30 days (configurable)

Think of it like a hotel key card — you check in (login), get a card (token), and it opens specific doors (abilities) until it expires.

---

## 2. Getting Started

### 2.1 Check the API is running

Before anything else, verify the API is healthy:

```bash
curl https://alpha.agri4all.com/api/v1/health
```

**Response:**
```json
{
  "data": {
    "status": "healthy",
    "checks": {
      "database": true,
      "meilisearch": true,
      "redis": true,
      "storage": true
    }
  }
}
```

If `status` is `"degraded"`, some services are down but the API is partially functional. If `"unhealthy"` (HTTP 503), all services are down.

### 2.2 Register a new user

Create a test account. Passwords require uppercase, lowercase, number, and symbol.

```bash
curl -X POST https://alpha.agri4all.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Farmer",
    "email": "testfarmer@example.com",
    "phone_number": "+27821234567",
    "password": "Test@1234",
    "password_confirmation": "Test@1234"
  }'
```

**Response (201 Created):**
```json
{
  "data": {
    "id": 42,
    "name": "Test Farmer",
    "email": "testfarmer@example.com",
    "phone_number": "+27821234567",
    "created_at": "2026-03-09T10:00:00+00:00"
  }
}
```

> **Note:** Registration does NOT return a token. You must login separately.

### 2.3 Login and get a token

```bash
curl -X POST https://alpha.agri4all.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testfarmer@example.com",
    "password": "Test@1234",
    "device_name": "My Laptop"
  }'
```

The `device_name` field identifies the client — use something descriptive like `"iPhone App"`, `"AI Agent Bot"`, or `"Postman Testing"`.

**Response (200 OK):**
```json
{
  "data": {
    "token": "1|abc123def456ghi789...",
    "token_type": "Bearer",
    "expires_at": "2026-04-08T10:00:00+00:00",
    "account_type": "user",
    "abilities": [
      "products:read",
      "categories:read",
      "users:read",
      "users:update",
      "search:products"
    ],
    "user": {
      "id": 42,
      "name": "Test Farmer",
      "email": "testfarmer@example.com"
    }
  }
}
```

**Save this token!** You'll need it for all authenticated requests.

### Understanding the login response

| Field | Meaning |
|-------|---------|
| `token` | Your Bearer token. Include it in every request header. |
| `token_type` | Always `"Bearer"`. |
| `expires_at` | When the token stops working (default: 30 days). |
| `account_type` | `"user"` for regular accounts, `"agent"` for agent accounts. |
| `abilities` | What this token can do. See [Section 10](#token-abilities) for the full list. |

**Abilities depend on your subscription tier:**
- **Free tier (Farm Sprout):** Read-only — `products:read`, `categories:read`, `users:read`, `users:update`, `search:products`
- **Paid tiers (Savvy and above):** Adds write access — `products:create`, `products:update`, `products:delete`, `products:media`

If an ability is missing from your token, requests requiring it will return a `403 FORBIDDEN` error.

### 2.4 Using your token

From now on, include the token in every request:

```bash
curl https://alpha.agri4all.com/api/v1/users/me \
  -H "Authorization: Bearer 1|abc123def456ghi789..."
```

### 2.5 Logout

Invalidates the current token only. Other tokens for the same account remain valid.

```bash
curl -X POST https://alpha.agri4all.com/api/v1/auth/logout \
  -H "Authorization: Bearer 1|abc123def456ghi789..."
```

**Response:** `204 No Content` (empty body)

---

## 3. Understanding the Basics

### 3.1 HTTP methods

| Method | Purpose | Example |
|--------|---------|---------|
| `GET` | Read data | Get product details |
| `POST` | Create data | Create a product, upload media |
| `PUT` | Replace/update data | Update profile, update product |
| `PATCH` | Partial update | Change product status |
| `DELETE` | Remove data | Delete a product, remove media |

### 3.2 Request headers

Always include these headers:

```
Content-Type: application/json       # For JSON requests
Authorization: Bearer <token>        # For authenticated endpoints
Accept: application/json             # Ensures JSON error responses
```

For file uploads, use `multipart/form-data` instead of `application/json` (curl does this automatically with `-F`).

### 3.3 Success responses

All successful responses wrap data in a `"data"` key:

```json
{
  "data": { ... }
}
```

For lists, the data is an array with pagination metadata:

```json
{
  "data": [ ... ],
  "meta": {
    "path": "https://alpha.agri4all.com/api/v1/products",
    "per_page": 25,
    "next_cursor": "eyJpZCI6MjUsIl9wb2ludHNUb05leHRJdGVtcyI6dHJ1ZX0",
    "prev_cursor": null,
    "request_id": "req_abc123..."
  }
}
```

All responses include a `meta.request_id` field — a unique identifier for the request, useful for debugging.

### 3.4 Cursor pagination

Most list endpoints use **cursor-based pagination** (25 items per page by default). This is different from page-number pagination — instead of `?page=2`, you use a cursor token:

```bash
# First page
curl https://alpha.agri4all.com/api/v1/products

# Next page (use next_cursor value from the meta)
curl "https://alpha.agri4all.com/api/v1/products?cursor=eyJpZCI6MjUuLi4"
```

**Why cursors?** They're more efficient for large datasets and don't break when new items are added between page loads.

> **Exception:** The [search endpoint](#57-search-products) uses page-based pagination instead of cursors (because Meilisearch returns page-based results). See [Section 5.7](#57-search-products) for details.

### 3.5 Error responses

All errors follow the same format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The given data was invalid.",
    "details": [
      {
        "field": "email",
        "message": "The email has already been taken."
      }
    ]
  }
}
```

| Field | Meaning |
|-------|---------|
| `code` | A machine-readable error code (see [Error Codes table](#error-codes)) |
| `message` | A human-readable explanation |
| `details` | Optional array of field-level errors |

All validation errors (422) are wrapped in the same `error` format shown above — the API normalizes Laravel's native validation responses into this consistent structure. You only need to handle one error format.

### 3.6 Rate limiting

The API limits how many requests you can make per minute, based on your identity:

| Identity | Limit |
|----------|-------|
| Unauthenticated (by IP) | 15/min |
| Farm Sprout (free) | 30/min |
| Farm Savvy / Vital | 60/min |
| Farm Prime | 120/min |
| Farm Elite / Master | 200/min |
| Agent accounts | 300/min |

When you exceed the limit, you'll receive a `429 Too Many Requests` response. Wait and retry.

Rate limit headers are included in every response:
- `X-RateLimit-Limit` — your limit
- `X-RateLimit-Remaining` — requests left in the current window

---

## 4. Working with Your Profile

### 4.1 View your profile

```bash
curl https://alpha.agri4all.com/api/v1/users/me \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "data": {
    "id": 42,
    "account_type": "user",
    "name": "Test Farmer",
    "email": "testfarmer@example.com",
    "phone_number": "+27821234567",
    "bio": null,
    "avatar": "https://alpha.agri4all.com/images/default-user.png",
    "social_links": null,
    "location": null,
    "created_at": "2026-03-09T10:00:00+00:00"
  }
}
```

### 4.2 Update your profile

Send only the fields you want to change (partial update):

```bash
curl -X PUT https://alpha.agri4all.com/api/v1/users/me \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Organic farmer in Limpopo specializing in citrus fruits.",
    "phone_number": "+27829876543",
    "location": {
      "country": "ZA",
      "state": "Limpopo",
      "city": "Polokwane"
    },
    "social_facebook": "https://facebook.com/testfarmer"
  }'
```

**Available profile fields:**

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | Max 255 chars |
| `email` | string | Must be unique |
| `phone_number` | string | Normalized to E.164 format |
| `bio` | string | Max 1000 chars |
| `social_facebook` | url | |
| `social_instagram` | url | |
| `social_x` | url | |
| `social_tiktok` | url | |
| `social_linkedin` | url | |
| `social_youtube` | url | |
| `location.country` | string | ISO 3166-1 alpha-2 code (e.g. `"ZA"`) |
| `location.state` | string | Province/state |
| `location.city` | string | |
| `location.zip` | string | Postal code |
| `location.latitude` | number | |
| `location.longitude` | number | |

### 4.3 Upload an avatar

Avatars use `multipart/form-data` (file upload), not JSON:

```bash
curl -X POST https://alpha.agri4all.com/api/v1/users/me/avatar \
  -H "Authorization: Bearer <token>" \
  -F "avatar=@/path/to/photo.jpg"
```

**Response:**
```json
{
  "data": {
    "avatar": "https://alpha.agri4all.com/storage/users/42/photo.jpg"
  }
}
```

**Constraints:** jpg, png, gif, webp. Max 5MB. Replaces any existing avatar.

### 4.4 Check your subscription

See your current tier, quota usage, and billing period:

```bash
curl https://alpha.agri4all.com/api/v1/users/me/subscription \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "data": {
    "tier": "farm-savvy",
    "label": "FARM SAVVY",
    "quota": {
      "products": {
        "limit": 10,
        "used": 3,
        "remaining": 7
      },
      "countries": {
        "limit": 1,
        "used": 1,
        "remaining": 0
      }
    },
    "price": 190000,
    "period_end": "2026-04-09T00:00:00+00:00",
    "status": "active"
  }
}
```

The `quota` section tells you how many products you can still create and how many countries you can list in. `price` is in **cents** (190000 = R1,900.00).

**Quota values:**
- A `limit` of `-1` means **unlimited** (Elite and Master tiers). `remaining` will also be `-1`.
- Free tier users get `status: "free"` instead of `"active"`. Other possible values: `"active"`, `"canceled"`, `"past_due"`.

### 4.5 List your products

```bash
curl https://alpha.agri4all.com/api/v1/users/me/products \
  -H "Authorization: Bearer <token>"
```

Filter by status:

```bash
# Only show approved products
curl "https://alpha.agri4all.com/api/v1/users/me/products?status=approved" \
  -H "Authorization: Bearer <token>"

# Only show pending products
curl "https://alpha.agri4all.com/api/v1/users/me/products?status=pending" \
  -H "Authorization: Bearer <token>"
```

Valid status filters: `approved`, `pending`, `rejected`, `incomplete`, `sold`, `archived`

---

## 5. Browsing the Marketplace

These endpoints are **public** — no authentication required.

### 5.1 List categories

Returns the full category tree:

```bash
curl https://alpha.agri4all.com/api/v1/categories
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Livestock",
      "slug": "livestock",
      "is_leaf": false,
      "children": [
        {
          "id": 5,
          "name": "Cattle",
          "slug": "cattle",
          "is_leaf": true,
          "children": []
        },
        {
          "id": 6,
          "name": "Poultry",
          "slug": "poultry",
          "is_leaf": true,
          "children": []
        }
      ]
    },
    {
      "id": 2,
      "name": "Crops",
      "slug": "crops",
      "is_leaf": false,
      "children": [ ... ]
    }
  ]
}
```

**Important:** When creating a product, you must use a **leaf category** (`is_leaf: true`). Parent categories are just for grouping.

### 5.2 Get category details (with dynamic fields)

Each leaf category has specific fields that products in it can fill out:

```bash
curl https://alpha.agri4all.com/api/v1/categories/dairy
```

**Response:**
```json
{
  "data": {
    "id": 184,
    "name": "Dairy",
    "slug": "dairy",
    "is_leaf": true,
    "fields": [
      {
        "name": "keywords",
        "label": "Keywords",
        "type": "text",
        "config": {
          "options": [],
          "rules": [
            "max:100"
          ],
          "placeholder": "Type keywords...",
          "when": null
        }
      },
      {
        "name": "component_price",
        "label": "component_price",
        "type": "component_price",
        "config": [
          {
            "color": "all",
            "type": "select",
            "name": "pricing_option",
            "label": "Price Option",
            "value": null,
            "options": [
              {
                "value": 1,
                "label": "Retail price"
              },
              {
                "value": 2,
                "label": "Price on request"
              },
              {
                "value": 3,
                "label": "Wholesale price"
              },
              {
                "value": 4,
                "label": "Price range"
              },
              {
                "value": 5,
                "label": "Starting price"
              },
              {
                "value": 6,
                "label": "Negotiable"
              }
            ],
            "rules": [
              "required"
            ]
          },
          {
            "color": "all",
            "type": "price",
            "name": "currency",
            "label": "Currency",
            "value": null,
            "rules": [
              "required",
              "min:1"
            ]
          },
          {
            "color": "all",
            "type": "price",
            "name": "price",
            "label": "Price",
            "value": null,
            "rules": [
              "nullable",
              "numeric"
            ]
          },
          {
            "color": "all",
            "type": "price",
            "name": "price_from",
            "label": "Price From",
            "value": null,
            "rules": [
              "nullable",
              "numeric"
            ]
          },
          {
            "color": "all",
            "type": "price",
            "name": "price_to",
            "label": "Price To",
            "value": null,
            "rules": [
              "nullable",
              "numeric"
            ]
          },
          {
            "color": "all",
            "type": "select",
            "name": "vat",
            "label": "Does the price include or exclude VAT?",
            "value": null,
            "options": [
              {
                "value": 1,
                "label": "Including VAT"
              },
              {
                "value": 2,
                "label": "Excluding VAT"
              },
              {
                "value": 3,
                "label": "VAT not applicable"
              }
            ],
            "rules": []
          }
        ]
      },
      {
        "name": "gender",
        "label": "Sex / Gender",
        "type": "select",
        "config": {
          "options": [
            "Male",
            "Female",
            "Mixed"
          ],
          "rules": [],
          "placeholder": null,
          "when": null
        }
      },
      {
        "name": "age",
        "label": "Animal age",
        "type": "text",
        "config": {
          "options": [],
          "rules": [],
          "placeholder": null,
          "when": null
        }
      },
      {
        "name": "tally",
        "label": "Number of animals",
        "type": "text",
        "config": {
          "options": [],
          "rules": [],
          "placeholder": null,
          "when": null
        }
      },
      {
        "name": "catalog",
        "label": "Catalogue",
        "type": "file",
        "config": {
          "options": [],
          "rules": [
            "mimes:pdf",
            "max:10000"
          ],
          "placeholder": null,
          "when": null
        }
      }
    ]
  },
  "meta": {
    "request_id": "req_Nmtkh6wHjlyMOjBz14RR"
  }
}
```

Use the `name` values (e.g. `"age"`, `"gender"`) as keys in the product's `fields` object when creating products.

### 5.3 List all products

```bash
curl https://alpha.agri4all.com/api/v1/products
```

**Response** (list format — less detail than single product):
```json
{
  "data": [
    {
      "id": 1,
      "slug": "angus-cattle-limpopo",
      "name": "Angus Cattle - Limpopo",
      "status": "approved",
      "category": {
        "id": 5,
        "name": "Cattle"
      },
      "price": {
        "type": "retail_price",
        "amount": "4500000.00",
        "currency": "ZAR",
        "formatted": "ZAR 45,000.00"
      },
      "location": {
        "city": "Polokwane",
        "country": "ZA"
      },
      "thumbnail": "https://alpha.agri4all.com/storage/products/1/thumb/photo.jpg",
      "user": {
        "id": 10,
        "name": "John Farmer"
      },
      "created_at": "2026-01-15T10:30:00+00:00"
    }
  ],
  "meta": { ... }
}
```

### 5.4 View a single product

```bash
curl https://alpha.agri4all.com/api/v1/products/angus-cattle-limpopo
```

**Response** (full detail):
```json
{
  "data": {
    "id": 1,
    "slug": "angus-cattle-limpopo",
    "name": "Angus Cattle - Limpopo",
    "description": "Premium Angus cattle raised on organic pastures in Limpopo province. 20 head available, aged 18-24 months.",
    "status": "approved",
    "category": {
      "id": 5,
      "name": "Cattle",
      "slug": "cattle"
    },
    "price": {
      "type": "retail_price",
      "amount": "4500000.00",
      "amount_from": null,
      "amount_to": null,
      "currency": "ZAR",
      "vat": "excluding_vat",
      "formatted": "ZAR 45,000.00"
    },
    "location": {
      "country": "ZA",
      "country_name": "South Africa",
      "state": "Limpopo",
      "city": "Polokwane",
      "zip": "0699",
      "latitude": -23.9045,
      "longitude": 29.4689
    },
    "contacts": [
      {
        "name": "John Farmer",
        "email": "john@example.com",
        "phone": "+27821234567",
        "preferred_contact": "phone"
      }
    ],
    "fields": {
      "breed": "angus",
      "age_months": "22",
      "weight_kg": "450"
    },
    "media": [
      {
        "id": 101,
        "url": "https://alpha.agri4all.com/storage/products/1/photo.jpg",
        "is_cover": true,
        "conversions": {
          "thumb": "https://alpha.agri4all.com/storage/products/1/conversions/photo-thumb.jpg",
          "medium": "https://alpha.agri4all.com/storage/products/1/conversions/photo-medium.jpg",
          "large": "https://alpha.agri4all.com/storage/products/1/conversions/photo-large.jpg"
        },
        "type": "image",
        "mime_type": "image/jpeg",
        "size": 245760,
        "collection": "products"
      }
    ],
    "user": {
      "id": 10,
      "name": "John Farmer"
    },
    "created_at": "2026-01-15T10:30:00+00:00",
    "updated_at": "2026-01-20T14:00:00+00:00"
  }
}
```

> **Owner-only data:** If you view your own product while authenticated, the response includes a `review` field with submission/review dates, rejection reasons, and review attempt count.

### 5.5 Browse products by category

```bash
curl https://alpha.agri4all.com/api/v1/categories/livestock/products
```

This returns all approved products in the "Livestock" category **and all its sub-categories** (cattle, poultry, etc.).

### 5.6 View public user profiles

```bash
# View user profile
curl https://alpha.agri4all.com/api/v1/users/10

# View user's products
curl https://alpha.agri4all.com/api/v1/users/10/products
```

### 5.7 Search products

Full-text search with powerful filtering:

```bash
# Simple text search
curl "https://alpha.agri4all.com/api/v1/search/products?q=organic+tomatoes"

# Search with filters
curl "https://alpha.agri4all.com/api/v1/search/products?\
q=cattle&\
category=livestock&\
country=ZA&\
price_min=100000&\
price_max=5000000&\
sort=price_asc&\
per_page=10"

# Geo search (products within 50km of Johannesburg)
curl "https://alpha.agri4all.com/api/v1/search/products?\
lat=-26.2041&\
lng=28.0473&\
radius=50"
```

**Search parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search text (optional — omit for browse-all) |
| `category` | string | Category slug (includes sub-categories) |
| `country` | string | ISO 3166-1 alpha-2 code (e.g. `ZA`) |
| `price_type` | string | `retail_price`, `price_on_request`, `wholesale_price`, `price_range`, `starting_price`, `negotiable` |
| `price_min` | integer | Minimum price in cents (see note below) |
| `price_max` | integer | Maximum price in cents (see note below) |
| `lat` | number | Latitude for geo search |
| `lng` | number | Longitude for geo search |
| `radius` | integer | Radius in km (default: 100, requires lat+lng) |
| `sort` | string | `newest`, `oldest`, `price_asc`, `price_desc` |
| `per_page` | integer | Results per page (1-100, default: 25) |
| `page` | integer | Page number |

> **Note on price filtering:** The `price_min` and `price_max` filters may not return results in the current release due to a known indexing issue with price data types. Price sorting (`price_asc`/`price_desc`) works correctly.

**Search pagination** uses page-based pagination (unlike the cursor-based pagination used by other list endpoints):

```json
{
  "data": [ ... ],
  "meta": {
    "current_page": 1,
    "from": 1,
    "last_page": 42,
    "per_page": 25,
    "to": 25,
    "total": 1043,
    "path": "https://alpha.agri4all.com/api/v1/search/products",
    "links": [ ... ],
    "request_id": "req_abc123..."
  }
}
```

> **Note:** Meilisearch caps `total` at 1000 by default. For result sets larger than 1000, the total may be approximate.

---

## 6. Managing Products (CRUD)

> **Requires:** Authentication + paid subscription (Farm Savvy or above). Free tier tokens lack the `products:create`, `products:update`, `products:delete`, and `products:media` abilities.

### 6.1 Create a product

Product creation uses `multipart/form-data` because you're sending both JSON data and file uploads in the same request. The JSON goes in a field called `payload`, and files go in `media[]`.

**Step 1:** First, look up the category to find the required fields:

```bash
curl https://alpha.agri4all.com/api/v1/categories/beef
```

**Step 2:** Create the product:

```bash
curl -X POST https://alpha.agri4all.com/api/v1/products \
  -H "Authorization: Bearer <token>" \
  -F 'payload={
    "name": "Angus Bulls - Limpopo",
    "description": "Premium Angus bulls raised on organic pastures in Limpopo province. 5 head available, aged 24-30 months. Excellent genetics with full breeding records available.",
    "category_id": 183,
    "price": {
      "type": "retail_price",
      "amount": 4500000,
      "currency": "ZAR",
      "vat": "excluding_vat"
    },
    "location": {
      "country": "ZA",
      "state": "Limpopo",
      "city": "Polokwane",
      "zip": "0699",
      "latitude": -23.9045,
      "longitude": 29.4689
    },
    "contacts": [
      {
        "name": "John Farmer",
        "email": "john@example.com",
        "phone": "+27821234567",
        "preferred_contact": "phone"
      }
    ],
    "fields": {
      "sex": "Male",
      "age": "8",
      "tally": "12"
    }
  }' \
  -F "media[]=@/path/to/bull-photo-1.jpg" \
  -F "media[]=@/path/to/bull-photo-2.jpg"
```

**Response (201 Created):** Returns the full product resource (same format as [Section 5.4](#54-view-a-single-product)).

### What happens after creation

1. The product is created with status **`pending`** (awaiting admin review)
2. An admin reviews the product on the Agri4All admin panel
3. If **approved**, it becomes searchable in the marketplace
4. If **rejected**, you can edit and resubmit (see [Section 6.4](#64-change-product-status))

### Understanding the payload

| Field | Required | Notes |
|-------|----------|-------|
| `name` | Yes | Product title. 3-255 characters. |
| `description` | Yes | Full description. 10-10,000 characters. |
| `category_id` | Yes | Must be a **leaf** category ID (no children). |
| `price` | Yes | Pricing details (see below). |
| `location` | Yes | Where the product is located. |
| `contacts` | Yes | At least one contact. |
| `fields` | No | Category-specific fields. Get field names from the category endpoint. |
| `media[]` | No | Product images. jpg, png, gif, webp, pdf. Max 10MB each. Can be added later via the [media endpoint](#72-upload-media). |

### Pricing types

| `type` value | When to use | Required price fields |
|-------------|-------------|----------------------|
| `retail_price` | Fixed price | `amount` |
| `wholesale_price` | Bulk/wholesale price | `amount` |
| `starting_price` | Starting from a base price | `amount` |
| `price_range` | Price varies within a range | `amount_from`, `amount_to` |
| `negotiable` | Price is negotiable | `amount` (indicative) |
| `price_on_request` | Contact seller for price | None |

**All amounts are in cents.** R150.00 = `15000`. R45,000.00 = `4500000`.

> **Note:** When *sending* prices, use integers (e.g. `15000`). In *responses*, amounts are returned as decimal strings (e.g. `"15000.00"`). The `formatted` field uses `"ZAR 150.00"` format (with currency code, not symbol).

**VAT options:** `including_vat`, `excluding_vat`, `vat_not_applicable`

### Quota check

Before creating, the API checks your subscription quota. If you've hit your product limit:

```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "You have reached your product limit for this subscription tier.",
    "details": [
      {
        "field": "subscription",
        "message": "FARM SAVVY allows 10 products. You have 10."
      }
    ]
  }
}
```

### 6.2 Update a product

Send only the fields you want to change:

```bash
curl -X PUT https://alpha.agri4all.com/api/v1/products/angus-bulls-limpopo-south-africa \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Updated: Premium Angus bulls, now 8 head available.",
    "price": {
      "type": "retail_price",
      "amount": 4800000,
      "currency": "ZAR",
      "vat": "excluding_vat"
    }
  }'
```

Updates also support `multipart/form-data` with a `payload` JSON string, just like creation.

### Re-approval logic

**Important:** If your product is currently **approved** and you change its content (name, description, category, price, location, or fields), it goes back to **pending** status for admin review. This is to prevent sellers from changing approved listings to something completely different.

**Contact changes do NOT trigger re-approval** — you can update contact info freely without losing your approved status.

### 6.3 Delete a product

```bash
curl -X DELETE https://alpha.agri4all.com/api/v1/products/angus-bulls-limpopo \
  -H "Authorization: Bearer <token>"
```

**Response:** `204 No Content`

This is a soft delete — the product is removed from search results and marketplace but stays in the database.

### 6.4 Change product status

Products follow a state machine. Only certain transitions are allowed:

```
INCOMPLETE ──> PENDING (submit for review)
APPROVED ────> SOLD (mark as sold)
APPROVED ────> ARCHIVED (archive listing)
REJECTED ────> PENDING (resubmit after editing)
SOLD ────────> ARCHIVED (archive sold item)
```

```bash
# Submit for review
curl -X PATCH https://alpha.agri4all.com/api/v1/products/angus-bulls-limpopo-south-africa/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "pending"}'

# Mark as sold
curl -X PATCH https://alpha.agri4all.com/api/v1/products/angus-bulls-limpopo-south-africa/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "sold"}'

# Archive
curl -X PATCH https://alpha.agri4all.com/api/v1/products/angus-bulls-limpopo-south-africa/status \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"status": "archived"}'
```

Invalid transitions return `422`:

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "status": ["Cannot transition from Approved to pending."]
  }
}
```

---

## 7. Product Sub-resources

Products have separate endpoints for contacts, location, and media. These let you update individual parts without touching the whole product.

### 7.1 View product contacts

```bash
curl https://alpha.agri4all.com/api/v1/products/angus-bulls-limpopo-south-africa/contacts
```

**Response:**
```json
{
  "data": [
    {
      "name": "John Farmer",
      "email": "john@example.com",
      "phone": "+27821234567",
      "preferred_contact": "phone"
    }
  ]
}
```

### 7.2 Update product contacts

Replaces **all** contacts for the product:

```bash
curl -X PUT https://alpha.agri4all.com/api/v1/products/angus-bulls-limpopo-south-africa/contacts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "contacts": [
      {
        "name": "John Farmer",
        "email": "john@example.com",
        "phone": "+27821234567",
        "preferred_contact": "phone"
      },
      {
        "name": "Jane Farmer",
        "email": "jane@example.com",
        "preferred_contact": "email"
      }
    ]
  }'
```

> **No re-approval:** Updating contacts does NOT change the product's approval status.

### 7.3 View product location

```bash
curl https://alpha.agri4all.com/api/v1/products/angus-bulls-limpopo-south-africa/location
```

**Response:**
```json
{
  "data": {
    "country": "ZA",
    "country_name": "South Africa",
    "state": "Limpopo",
    "city": "Polokwane",
    "zip": "0699",
    "latitude": -23.9045,
    "longitude": 29.4689
  }
}
```

### 7.4 Update product location

```bash
curl -X PUT https://alpha.agri4all.com/api/v1/products/angus-bulls-limpopo-south-africa/location \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "country": "ZA",
    "state": "Gauteng",
    "city": "Pretoria",
    "latitude": -25.7479,
    "longitude": 28.2293
  }'
```

### 7.5 Upload product media

Upload one or more files to a product:

```bash
curl -X POST https://alpha.agri4all.com/api/v1/products/angus-bulls-limpopo-south-africa/media \
  -H "Authorization: Bearer <token>" \
  -F "media[]=@/path/to/photo1.jpg" \
  -F "media[]=@/path/to/photo2.jpg" \
  -F "cover=0"
```

**Parameters:**

| Field | Type | Description |
|-------|------|-------------|
| `media[]` | file(s) | One or more files. jpg, png, gif, webp, pdf. Max 10MB each. |
| `collection` | string | `"products"` (default) or `"catalogs"` (for dynamic field files) |
| `cover` | integer | Index (0-based) of the file to set as cover image |

**Response (201 Created):**
```json
{
  "data": [
    {
      "id": 102,
      "url": "https://alpha.agri4all.com/storage/products/1/photo1.jpg",
      "is_cover": true,
      "conversions": {
        "thumb": "...",
        "medium": "...",
        "large": "..."
      },
      "type": "image",
      "mime_type": "image/jpeg",
      "size": 245760,
      "collection": "products"
    },
    {
      "id": 103,
      "url": "https://alpha.agri4all.com/storage/products/1/photo2.jpg",
      "is_cover": false,
      "conversions": { ... },
      "type": "image",
      "mime_type": "image/jpeg",
      "size": 189440,
      "collection": "products"
    }
  ]
}
```

### 7.6 Delete a media item

```bash
curl -X DELETE https://alpha.agri4all.com/api/v1/products/angus-bulls-limpopo-south-africa/media/102 \
  -H "Authorization: Bearer <token>"
```

**Response:** `204 No Content`

---

## 8. Idempotency

### What is idempotency?

When building automated systems (especially AI agents), things can go wrong — network timeouts, retries, duplicate submissions. **Idempotency** prevents duplicate actions.

If you send the same request twice with the same `Idempotency-Key`, the API returns the **original response** instead of executing the action again. This prevents creating duplicate products, uploading duplicate media, etc.

### How to use it

Add an `Idempotency-Key` header to any write request (POST, PUT, PATCH, DELETE):

```bash
curl -X POST https://alpha.agri4all.com/api/v1/products \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: create-angus-bulls-2026-03-09" \
  -F 'payload={ ... }' \
  -F "media[]=@/path/to/photo.jpg"
```

**Rules:**
- The key can be any unique string (UUID recommended)
- Keys expire after **24 hours**
- If you send the same key with a **different request body**, you get a `409 IDEMPOTENCY_CONFLICT` error (for JSON requests)
- The replayed response includes an `X-Idempotent-Replayed: true` header so you know it's a replay

> **Known limitation:** Conflict detection (`409 IDEMPOTENCY_CONFLICT`) works reliably for JSON (`Content-Type: application/json`) requests. For `multipart/form-data` requests (product creation with file uploads), the body comparison may not detect changes because multipart boundaries differ between requests. In practice, this means a replayed multipart request with a different body will return the original cached response rather than a 409 error. Use unique idempotency keys per logical operation to avoid this edge case.

### When to use it

- **Always** when automating product creation (agents)
- **Always** when retrying failed requests
- Optional for manual testing, but good practice

### Example: Safe retry

```bash
# Generate a unique key
KEY=$(uuidgen)

# First attempt (maybe the network times out and you don't see the response)
curl -X POST https://alpha.agri4all.com/api/v1/products \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: $KEY" \
  -F 'payload={...}'

# Retry with the same key — safe! Returns the original response, doesn't create a duplicate
curl -X POST https://alpha.agri4all.com/api/v1/products \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: $KEY" \
  -F 'payload={...}'
```

---

## 9. Acting as an Agent

### What is an agent?

An **agent account** is a special account type designed for AI systems and service providers that manage products on behalf of multiple sellers. Instead of each seller logging in themselves, an agent logs in once and acts on behalf of any seller who has granted them a **delegation**.

### How delegations work

```
┌──────────────┐      grants delegation      ┌──────────────┐
│    Seller     │ ──────────────────────────>  │    Agent     │
│  (user acct)  │                              │  (agent acct) │
│              │  <── acts on behalf of ──── │              │
└──────────────┘                              └──────────────┘
```

1. A seller grants an agent delegation through the Agri4All website (admin-managed)
2. The delegation specifies which **abilities** the agent has (e.g. create products, upload media)
3. The delegation has an **expiry date**
4. The seller can **revoke** the delegation at any time

### Setting up delegations (Admin Panel)

Agent delegations are managed through the Filament admin panel. Here's the end-to-end workflow:

#### 1. Creating an agent user

Agent users are **not** created through normal registration. They must have `account_type = 'agent'` set explicitly. For security reasons, Garth is the only one that can do this.

#### 2. Navigating to Agent Delegations

Go to `/admin/agent-delegations` in the admin panel, then click the **"Bulk Assign Sellers"** button.

#### 3. Finding the agent in the dropdown

The **Agent** dropdown is **search-based** — options don't preload. Type the agent's name or email to find them. This is intentional to prevent accidental selection when there are many users.

#### 4. Selecting sellers

The **Sellers** dropdown uses the same search-based UX. Type a seller's name or email (or part thereof) to find and select them. You can select multiple sellers at once.

#### 5. What happens on submit

When you submit the bulk assignment:
- Creates **active** delegations with default abilities for each selected seller
- **Skips duplicates** — if a delegation already exists between that agent and seller, it won't create a second one
- Shows a summary: count of delegations created vs skipped

#### 6. Managing delegations

The delegations list has tabs for filtering by status:
- **All** — every delegation
- **Active** — currently active delegations
- **Suspended** — temporarily paused delegations
- **Revoked** — permanently revoked delegations

Available actions on each delegation:
- **Suspend** — temporarily pause an active delegation
- **Revoke** — permanently revoke a delegation
- **Reactivate** — restore a suspended or revoked delegation

### Agent login

Agent login works the same as regular login, but the response is different:

```bash
curl -X POST https://alpha.agri4all.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "agent@agri4all.com",
    "password": "AgentP@ss123",
    "device_name": "AI Agent Bot"
  }'
```

**Response:**
```json
{
  "data": {
    "token": "2|xyz789...",
    "token_type": "Bearer",
    "expires_at": "2026-04-08T10:00:00+00:00",
    "account_type": "agent",
    "abilities": [
      "products:read",
      "products:create",
      "products:update",
      "products:delete",
      "products:media",
      "categories:read",
      "users:read",
      "search:products",
      "agents:delegate"
    ],
    "agent": {
      "id": 100,
      "name": "AI Agent Bot",
      "delegation_count": 3
    }
  }
}
```

Notice: `account_type` is `"agent"`, the `"agent"` field replaces `"user"`, and the abilities include `agents:delegate`.

### The X-On-Behalf-Of header

When an agent performs **write operations** (create, update, delete), it must specify which seller it's acting for using the `X-On-Behalf-Of` header:

```bash
curl -X POST https://alpha.agri4all.com/api/v1/products \
  -H "Authorization: Bearer 2|xyz789..." \
  -H "X-On-Behalf-Of: 42" \
  -H "Idempotency-Key: agent-create-product-001" \
  -F "payload=<product.json" \
  -F "media[]=@photo.jpg"
```

> **Tip:** The `<` prefix in `-F "payload=<product.json"` reads the file's contents as the field value (unlike `@` which uploads the file itself). This avoids shell quoting issues with inline JSON. See the [full product creation example](#creating-a-product) for the `product.json` structure.

The `42` is the **seller's user ID**. The product will be created as if seller 42 created it themselves.

**Rules:**
- `X-On-Behalf-Of` is **required** for all write operations by agents
- `X-On-Behalf-Of` is **optional** for read operations (omit to read as the agent, include to read as the seller)
- The agent must have an **active delegation** for the specified seller
- The delegation must include the **required ability** for the operation

### Error responses for agents

**Missing header on write:**
```json
{
  "error": {
    "code": "DELEGATION_REQUIRED",
    "message": "Agent requests that modify resources must include the X-On-Behalf-Of header."
  }
}
```

**No active delegation:**
```json
{
  "error": {
    "code": "DELEGATION_DENIED",
    "message": "This agent does not have delegation rights for seller 42.",
    "details": [
      {
        "field": "X-On-Behalf-Of",
        "message": "No active delegation found for seller_id 42."
      }
    ]
  }
}
```

**Delegation lacks required ability:**
```json
{
  "error": {
    "code": "DELEGATION_DENIED",
    "message": "This delegation does not include the required ability.",
    "details": [
      {
        "field": "ability",
        "message": "Delegation for seller 42 does not include 'products:delete'."
      }
    ]
  }
}
```

### View your delegations

List all sellers you can act on behalf of:

```bash
curl https://alpha.agri4all.com/api/v1/agents/delegations \
  -H "Authorization: Bearer 2|xyz789..."
```

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "seller_id": 42,
      "seller_name": "John Farmer",
      "abilities": [
        "products:read",
        "products:create",
        "products:update",
        "products:delete",
        "products:media"
      ],
      "seller_quota": {
        "products": {
          "limit": 10,
          "used": 3,
          "remaining": 7
        },
        "countries": {
          "limit": 1,
          "used": 1,
          "remaining": 0
        }
      },
      "status": "active",
      "expires_at": "2026-12-31T23:59:59+00:00",
      "granted_at": "2026-01-01T00:00:00+00:00"
    }
  ]
}
```

Filter by status: `?status=active` (default), `?status=revoked`, `?status=expired`, `?status=all`

> **Quota values:** A `limit` of `-1` means the seller has an **unlimited** subscription (Elite or Master tier). `remaining` will also be `-1`. Always check for `-1` before doing arithmetic on quota values.

### View a specific seller's delegation

```bash
curl https://alpha.agri4all.com/api/v1/agents/delegations/42 \
  -H "Authorization: Bearer 2|xyz789..."
```

Returns the delegation details for seller 42, including their current quota usage. This is useful for checking if a seller has room for more products before creating one.

### Agent workflow summary

A typical AI agent workflow:

```
1. Login as agent → get token
2. List delegations → see which sellers to work with
3. For each seller:
   a. Check delegation → verify abilities and quota
   b. List categories → find appropriate category
   c. Get category fields → know what fields to fill
   d. Create product (with X-On-Behalf-Of) → product created as pending
   e. Upload media (with X-On-Behalf-Of) → add photos
   f. Verify → GET the product to confirm creation
```

---

## 10. Quick Reference

### All endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | No | Service health check |
| `POST` | `/auth/register` | No | Register new user |
| `POST` | `/auth/login` | No | Login, get token |
| `POST` | `/auth/logout` | Yes | Revoke current token |
| `GET` | `/categories` | No | List category tree |
| `GET` | `/categories/{slug}` | No | Category details + fields |
| `GET` | `/categories/{slug}/products` | No | Products in category |
| `GET` | `/products` | No | List approved products |
| `POST` | `/products` | Yes | Create product |
| `GET` | `/products/{slug}` | No | Product details |
| `PUT` | `/products/{slug}` | Yes | Update product |
| `DELETE` | `/products/{slug}` | Yes | Delete product |
| `PATCH` | `/products/{slug}/status` | Yes | Change product status |
| `GET` | `/products/{slug}/contacts` | No | Product contacts |
| `PUT` | `/products/{slug}/contacts` | Yes | Update contacts |
| `GET` | `/products/{slug}/location` | No | Product location |
| `PUT` | `/products/{slug}/location` | Yes | Update location |
| `POST` | `/products/{slug}/media` | Yes | Upload media |
| `DELETE` | `/products/{slug}/media/{id}` | Yes | Delete media |
| `GET` | `/search/products` | No | Search products |
| `GET` | `/users/me` | Yes | Your profile |
| `PUT` | `/users/me` | Yes | Update profile |
| `POST` | `/users/me/avatar` | Yes | Upload avatar |
| `GET` | `/users/me/products` | Yes | Your products |
| `GET` | `/users/me/subscription` | Yes | Your subscription |
| `GET` | `/users/{id}` | No | Public user profile |
| `GET` | `/users/{id}/products` | No | User's public products |
| `GET` | `/agents/delegations` | Yes | Agent's delegations |
| `GET` | `/agents/delegations/{sellerId}` | Yes | Delegation for seller |

All endpoints are prefixed with `https://alpha.agri4all.com/api/v1`.

### Token abilities

| Ability | Description | Who gets it |
|---------|-------------|-------------|
| `products:read` | View products | All users, agents |
| `products:create` | Create products | Paid users, agents |
| `products:update` | Update products | Paid users, agents |
| `products:delete` | Delete products | Paid users, agents |
| `products:media` | Upload/delete media | Paid users, agents |
| `categories:read` | View categories | All users, agents |
| `users:read` | View user profiles | All users, agents |
| `users:update` | Update own profile | All users |
| `search:products` | Search products | All users, agents |
| `agents:delegate` | Access delegations | Agents only |

### Error codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `UNAUTHENTICATED` | 401 | Missing or invalid token |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `FORBIDDEN` | 403 | Token lacks required ability |
| `QUOTA_EXCEEDED` | 403 | Subscription product/country limit reached |
| `DELEGATION_DENIED` | 403 | No delegation or missing ability for seller |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `IDEMPOTENCY_CONFLICT` | 409 | Same key used with different request body |
| `VALIDATION_ERROR` | 422 | Invalid input data |
| `RATE_LIMITED` | 429 | Too many requests |
| `DELEGATION_REQUIRED` | 400 | Agent write without X-On-Behalf-Of header |

### Pricing types

| API value | Description |
|-----------|-------------|
| `retail_price` | Fixed retail price |
| `wholesale_price` | Wholesale/bulk price |
| `starting_price` | Starting from price |
| `price_range` | Price range (from-to) |
| `negotiable` | Negotiable price |
| `price_on_request` | Contact seller for price |

### VAT options

| API value | Description |
|-----------|-------------|
| `including_vat` | Price includes VAT |
| `excluding_vat` | Price excludes VAT |
| `vat_not_applicable` | VAT not applicable |

### Product statuses

| API value | Description |
|-----------|-------------|
| `incomplete` | Draft, not submitted |
| `pending` | Submitted, awaiting review |
| `approved` | Live in marketplace |
| `rejected` | Rejected by admin |
| `rejected_pending` | Resubmitted after rejection |
| `finally_rejected` | Permanently rejected |
| `sold` | Marked as sold |
| `expired` | Listing expired |
| `archived` | Archived by user |

### Product status transitions

```
                    ┌──────────────────────────────────┐
                    │                                  │
                    v                                  │
INCOMPLETE ──> PENDING ──> APPROVED ──> SOLD ──> ARCHIVED
                              │                    ^
                              │                    │
                              └─── ARCHIVED ───────┘

REJECTED ──> (edit) ──> PENDING (becomes REJECTED_PENDING) ──> APPROVED
                                                            └──> FINALLY_REJECTED
```

### Subscription tiers

| Tier | Monthly Price | Products | Countries | API Rate Limit |
|------|--------------|----------|-----------|----------------|
| Farm Sprout | Free | 2 | 1 | 30/min |
| Farm Savvy | R1,900 | 10 | 1 | 60/min |
| Farm Vital | R2,900 | 10 | 1 | 60/min |
| Farm Prime | R6,900 | 30 | 1 | 120/min |
| Farm Elite | R11,900 | unlimited | 5 | 200/min |
| Farm Master | R24,900 | unlimited | 29 | 200/min |

### Country codes

The API uses **ISO 3166-1 alpha-2** country codes. Common examples:

| Code | Country |
|------|---------|
| `ZA` | South Africa |
| `KE` | Kenya |
| `NG` | Nigeria |
| `GH` | Ghana |
| `TZ` | Tanzania |
| `UG` | Uganda |
| `ZM` | Zambia |
| `ZW` | Zimbabwe |
| `MZ` | Mozambique |
| `BW` | Botswana |

### Special headers

| Header | Direction | Purpose |
|--------|-----------|---------|
| `Authorization: Bearer <token>` | Request | Authentication |
| `Idempotency-Key: <unique-string>` | Request | Prevent duplicate writes |
| `X-On-Behalf-Of: <seller-id>` | Request | Agent delegation (who to act as) |
| `X-Idempotent-Replayed: true` | Response | Indicates replayed idempotent response |
| `X-RateLimit-Limit` | Response | Your rate limit |
| `X-RateLimit-Remaining` | Response | Requests remaining |

---

## Appendix A: Day 1 Testing Plan

A structured checklist to walk through every API feature. Work through these scenarios in order — each builds on the previous. Use curl, Postman, or any HTTP client.

> **Before starting:** Make sure the staging environment is running and accessible at `https://alpha.agri4all.com`. Have a test image file ready (any .jpg under 10MB).

### Prerequisites

```bash
# Set your base URL as a variable (saves typing)
export BASE=https://alpha.agri4all.com/api/v1
```

---

### Phase 1: Infrastructure & Public Endpoints (no auth needed)

These tests verify the API is working and public data is accessible.

- [ ] **T1.1 — Health check**
  ```bash
  curl $BASE/health
  ```
  - Verify: HTTP 200, `status` is `"healthy"`, all checks are `true`

- [ ] **T1.2 — List categories**
  ```bash
  curl $BASE/categories
  ```
  - Verify: Returns category tree with `id`, `name`, `slug`, `is_leaf`, `children`
  - Note down: A leaf category `id` and `slug` for later use (e.g. `cattle` or `vegetables`)

- [ ] **T1.3 — Get category detail with fields**
  ```bash
  curl $BASE/categories/<slug-from-T1.2>
  ```
  - Verify: Returns `fields` array with `name`, `label`, `type`, `config`
  - Note down: Required field names and their allowed values for product creation

- [ ] **T1.4 — List approved products**
  ```bash
  curl $BASE/products
  ```
  - Verify: Returns paginated list with `data` array and `meta` object
  - Note down: A product `slug` for later use

- [ ] **T1.5 — View single product**
  ```bash
  curl $BASE/products/<slug-from-T1.4>
  ```
  - Verify: Returns full product with `price`, `location`, `contacts`, `fields`, `media`

- [ ] **T1.6 — View product sub-resources**
  ```bash
  curl $BASE/products/<slug>/contacts
  curl $BASE/products/<slug>/location
  ```
  - Verify: Both return data in expected format

- [ ] **T1.7 — Browse products by category**
  ```bash
  curl $BASE/categories/<slug>/products
  ```
  - Verify: Returns products belonging to that category (and its sub-categories)

- [ ] **T1.8 — Search products**
  ```bash
  # Basic search
  curl "$BASE/search/products?q=farm"

  # With filters
  curl "$BASE/search/products?country=ZA&sort=newest&per_page=5"

  # Empty search (browse all)
  curl "$BASE/search/products?per_page=5"
  ```
  - Verify: Returns paginated results, filters narrow the results

- [ ] **T1.9 — View public user profile**
  ```bash
  curl $BASE/users/1
  curl $BASE/users/1/products
  ```
  - Verify: Profile returns public info (no email/phone). Products returns only approved ones.

- [ ] **T1.10 — Test 404 handling**
  ```bash
  curl $BASE/products/this-slug-does-not-exist
  ```
  - Verify: HTTP 404 response

---

### Phase 2: Authentication

- [ ] **T2.1 — Register a test user**
  ```bash
  curl -X POST $BASE/auth/register \
    -H "Content-Type: application/json" \
    -d '{
      "name": "API Test User",
      "email": "apitest-'$(date +%s)'@example.com",
      "phone_number": "+27820001111",
      "password": "Test@12345",
      "password_confirmation": "Test@12345"
    }'
  ```
  - Verify: HTTP 201, returns `id`, `name`, `email`
  - Note down: The email you used

- [ ] **T2.2 — Attempt duplicate registration**
  ```bash
  # Use the SAME email from T2.1
  curl -X POST $BASE/auth/register \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Duplicate User",
      "email": "<email-from-T2.1>",
      "phone_number": "+27820002222",
      "password": "Test@12345",
      "password_confirmation": "Test@12345"
    }'
  ```
  - Verify: HTTP 422 with `"The email has already been taken."`

- [ ] **T2.3 — Login**
  ```bash
  curl -X POST $BASE/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "<email-from-T2.1>",
      "password": "Test@12345",
      "device_name": "Testing Terminal"
    }'
  ```
  - Verify: HTTP 200, returns `token`, `abilities`, `account_type: "user"`
  - Save the token:
    ```bash
    export TOKEN="<paste-token-here>"
    ```

- [ ] **T2.4 — Login with wrong password**
  ```bash
  curl -X POST $BASE/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "<email-from-T2.1>",
      "password": "WrongPassword123!",
      "device_name": "Testing Terminal"
    }'
  ```
  - Verify: HTTP 401 with `INVALID_CREDENTIALS`

- [ ] **T2.5 — Access authenticated endpoint without token**
  ```bash
  curl $BASE/users/me
  ```
  - Verify: HTTP 401 with `UNAUTHENTICATED`

- [ ] **T2.6 — Access authenticated endpoint with token**
  ```bash
  curl $BASE/users/me -H "Authorization: Bearer $TOKEN"
  ```
  - Verify: HTTP 200, returns your profile

---

### Phase 3: User Profile Management

- [ ] **T3.1 — Update profile**
  ```bash
  curl -X PUT $BASE/users/me \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "bio": "Test farmer for API testing",
      "location": {
        "country": "ZA",
        "state": "Gauteng",
        "city": "Johannesburg"
      }
    }'
  ```
  - Verify: Response includes updated `bio` and `location`

- [ ] **T3.2 — Upload avatar**
  ```bash
  curl -X POST $BASE/users/me/avatar \
    -H "Authorization: Bearer $TOKEN" \
    -F "avatar=@/path/to/test-image.jpg"
  ```
  - Verify: Returns `avatar` URL. Open the URL in a browser to confirm the image loads.

- [ ] **T3.3 — Check subscription**
  ```bash
  curl $BASE/users/me/subscription \
    -H "Authorization: Bearer $TOKEN"
  ```
  - Verify: Returns tier info with quota. Free users show `tier: "farm-sprout"`, `products.limit: 2`

- [ ] **T3.4 — List your products (should be empty)**
  ```bash
  curl $BASE/users/me/products \
    -H "Authorization: Bearer $TOKEN"
  ```
  - Verify: Returns empty `data: []`

---

### Phase 4: Product CRUD (requires paid subscription)

> **Important:** Free tier users cannot create products via API (missing `products:create` ability). For this phase, either:
> - Use an existing account with a paid subscription
> - Upgrade the test account's subscription in the admin panel
> - Login as a user who already has a paid tier

- [ ] **T4.1 — Verify write abilities**
  ```bash
  # Login with a paid-tier account and check abilities
  curl -X POST $BASE/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "<paid-user-email>",
      "password": "<password>",
      "device_name": "Testing Terminal"
    }'
  ```
  - Verify: `abilities` includes `products:create`, `products:update`, `products:delete`, `products:media`
  - Save: `export TOKEN="<new-token>"`

- [ ] **T4.2 — Create a product (JSON only, no media)**
  ```bash
  curl -X POST $BASE/products \
    -H "Authorization: Bearer $TOKEN" \
    -F 'payload={
      "name": "API Test Product - Organic Tomatoes",
      "description": "Fresh organic tomatoes for testing the API. This is a test product created via the Agri4All API v1. Please ignore this listing.",
      "category_id": <leaf-category-id-from-T1.2>,
      "price": {
        "type": "retail_price",
        "amount": 15000,
        "currency": "ZAR",
        "vat": "including_vat"
      },
      "location": {
        "country": "ZA",
        "state": "Gauteng",
        "city": "Pretoria"
      },
      "contacts": [
        {
          "name": "API Tester",
          "email": "tester@example.com",
          "phone": "+27821111222",
          "preferred_contact": "email"
        }
      ]
    }'
  ```
  - Verify: HTTP 201, `status` is `"pending"`, returns full product
  - Note down: The product `slug` and `id`

- [ ] **T4.3 — Verify the product appears in your list**
  ```bash
  curl "$BASE/users/me/products?status=pending" \
    -H "Authorization: Bearer $TOKEN"
  ```
  - Verify: Your new product appears in the list

- [ ] **T4.4 — View the created product**
  ```bash
  curl $BASE/products/<slug-from-T4.2> \
    -H "Authorization: Bearer $TOKEN"
  ```
  - Verify: Full product details match what you submitted
  - Verify: `review` block is present (you're the owner)

- [ ] **T4.5 — Update the product**
  ```bash
  curl -X PUT $BASE/products/<slug> \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "description": "Updated description: Premium organic tomatoes from Pretoria."
    }'
  ```
  - Verify: Description is updated in response

- [ ] **T4.6 — Update product contacts (should NOT trigger re-approval)**
  ```bash
  curl -X PUT $BASE/products/<slug>/contacts \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "contacts": [
        {
          "name": "Updated Tester",
          "email": "updated@example.com",
          "phone": "+27829999888",
          "preferred_contact": "both"
        }
      ]
    }'
  ```
  - Verify: Contacts updated, product status unchanged

- [ ] **T4.7 — Update product location**
  ```bash
  curl -X PUT $BASE/products/<slug>/location \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "country": "ZA",
      "state": "Western Cape",
      "city": "Cape Town",
      "latitude": -33.9249,
      "longitude": 18.4241
    }'
  ```
  - Verify: Location updated in response

- [ ] **T4.8 — Upload media to product**
  ```bash
  curl -X POST $BASE/products/<slug>/media \
    -H "Authorization: Bearer $TOKEN" \
    -F "media[]=@/path/to/test-image.jpg" \
    -F "cover=0"
  ```
  - Verify: HTTP 201, returns media with `id`, `url`, `is_cover: true`, `conversions`
  - Note down: The media `id`
  - Open the `url` in a browser to confirm the image loads

- [ ] **T4.9 — Delete media**
  ```bash
  curl -X DELETE $BASE/products/<slug>/media/<media-id> \
    -H "Authorization: Bearer $TOKEN"
  ```
  - Verify: HTTP 204

- [ ] **T4.10 — Create a product with media in one request**
  ```bash
  curl -X POST $BASE/products \
    -H "Authorization: Bearer $TOKEN" \
    -F 'payload={
      "name": "API Test Product With Photo",
      "description": "Testing product creation with media upload in a single request. This is a test product.",
      "category_id": <leaf-category-id>,
      "price": {
        "type": "price_on_request",
        "currency": "ZAR"
      },
      "location": {
        "country": "ZA",
        "city": "Durban"
      },
      "contacts": [
        {
          "name": "Photo Tester",
          "email": "photo@example.com",
          "preferred_contact": "email"
        }
      ]
    }' \
    -F "media[]=@/path/to/test-image.jpg"
  ```
  - Verify: HTTP 201, product has media in response

- [ ] **T4.11 — Test validation errors**
  ```bash
  # Missing required fields
  curl -X POST $BASE/products \
    -H "Authorization: Bearer $TOKEN" \
    -F 'payload={"name": "X"}'
  ```
  - Verify: HTTP 422 with field-level error messages

- [ ] **T4.12 — Test invalid JSON payload**
  ```bash
  curl -X POST $BASE/products \
    -H "Authorization: Bearer $TOKEN" \
    -F 'payload=this is not json'
  ```
  - Verify: HTTP 422 with `"The payload must be valid JSON"`

- [ ] **T4.13 — Delete the product**
  ```bash
  curl -X DELETE $BASE/products/<slug-from-T4.2> \
    -H "Authorization: Bearer $TOKEN"
  ```
  - Verify: HTTP 204

- [ ] **T4.14 — Verify deleted product is gone**
  ```bash
  curl $BASE/products/<slug-from-T4.2>
  ```
  - Verify: HTTP 404

---

### Phase 5: Product Status Transitions

> For this phase, create a fresh product and have an admin approve it via the admin panel.

- [ ] **T5.1 — Create a product and note the slug**
  - Use the same curl from T4.2
  - Verify: Status is `pending`

- [ ] **T5.2 — Have an admin approve the product**
  - Go to `https://alpha.agri4all.com/admin` and approve the product
  - Then verify via API:
    ```bash
    curl $BASE/products/<slug> -H "Authorization: Bearer $TOKEN"
    ```
  - Verify: Status is now `approved`

- [ ] **T5.3 — Mark as sold**
  ```bash
  curl -X PATCH $BASE/products/<slug>/status \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status": "sold"}'
  ```
  - Verify: Status changes to `sold`

- [ ] **T5.4 — Archive the sold product**
  ```bash
  curl -X PATCH $BASE/products/<slug>/status \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status": "archived"}'
  ```
  - Verify: Status changes to `archived`

- [ ] **T5.5 — Test invalid transition**
  ```bash
  # Try to move an archived product back to pending
  curl -X PATCH $BASE/products/<slug>/status \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"status": "pending"}'
  ```
  - Verify: HTTP 422 with `"Cannot transition from Archived to pending."`

- [ ] **T5.6 — Test re-approval trigger**
  - Create a new product, have admin approve it
  - Then update its content:
    ```bash
    curl -X PUT $BASE/products/<approved-slug> \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"name": "Changed Name Triggers Re-approval"}'
    ```
  - Verify: Status reverts to `pending`

---

### Phase 6: Idempotency

- [ ] **T6.1 — Create product with idempotency key**
  ```bash
  export IDEM_KEY="test-idempotency-$(date +%s)"

  curl -X POST $BASE/products \
    -H "Authorization: Bearer $TOKEN" \
    -H "Idempotency-Key: $IDEM_KEY" \
    -F 'payload={
      "name": "Idempotency Test Product",
      "description": "Testing idempotent product creation. This product should only be created once.",
      "category_id": <leaf-category-id>,
      "price": {"type": "retail_price", "amount": 10000, "currency": "ZAR"},
      "location": {"country": "ZA"},
      "contacts": [{"name": "Test", "email": "test@example.com"}]
    }'
  ```
  - Note down: The product `id` from the response

- [ ] **T6.2 — Replay with same key and body**
  ```bash
  # Run the EXACT same curl from T6.1 with the same IDEM_KEY
  ```
  - Verify: Returns the same response as T6.1 (same product `id`)
  - Verify: Response includes `X-Idempotent-Replayed: true` header
  - Verify: Only ONE product was created (check your product list)

- [ ] **T6.3 — Same key, different body (conflict)**
  ```bash
  curl -X POST $BASE/products \
    -H "Authorization: Bearer $TOKEN" \
    -H "Idempotency-Key: $IDEM_KEY" \
    -F 'payload={
      "name": "Different Product Same Key",
      "description": "This has a different body but the same idempotency key.",
      "category_id": <leaf-category-id>,
      "price": {"type": "retail_price", "amount": 99999, "currency": "ZAR"},
      "location": {"country": "ZA"},
      "contacts": [{"name": "Test", "email": "test@example.com"}]
    }'
  ```
  - Verify: HTTP 409 with `IDEMPOTENCY_CONFLICT`

---

### Phase 7: Search & Filtering

- [ ] **T7.1 — Text search**
  ```bash
  curl "$BASE/search/products?q=cattle"
  ```
  - Verify: Results contain products related to "cattle"

- [ ] **T7.2 — Category filter**
  ```bash
  curl "$BASE/search/products?category=livestock"
  ```
  - Verify: Results are only from livestock categories

- [ ] **T7.3 — Country filter**
  ```bash
  curl "$BASE/search/products?country=ZA"
  ```
  - Verify: Results are only from South Africa

- [ ] **T7.4 — Price range filter**
  ```bash
  curl "$BASE/search/products?price_min=10000&price_max=100000"
  ```
  - Verify: All results have prices between R100 and R1000

- [ ] **T7.5 — Geo search**
  ```bash
  # Products within 50km of Johannesburg
  curl "$BASE/search/products?lat=-26.2041&lng=28.0473&radius=50"
  ```
  - Verify: Returns products near Johannesburg

- [ ] **T7.6 — Sorting**
  ```bash
  curl "$BASE/search/products?sort=price_asc&per_page=5"
  curl "$BASE/search/products?sort=price_desc&per_page=5"
  ```
  - Verify: Results are ordered by price ascending/descending

- [ ] **T7.7 — Combined filters**
  ```bash
  curl "$BASE/search/products?q=organic&country=ZA&price_max=500000&sort=newest&per_page=10"
  ```
  - Verify: All filters are applied together

- [ ] **T7.8 — Pagination**
  ```bash
  curl "$BASE/search/products?per_page=2"
  ```
  - Verify: Only 2 results returned, `meta` has `next_page_url`
  - Follow the `next_page_url` to get the next page

---

### Phase 8: Error Handling & Edge Cases

- [ ] **T8.1 — Expired/invalid token**
  ```bash
  curl $BASE/users/me -H "Authorization: Bearer invalid-token-12345"
  ```
  - Verify: HTTP 401

- [ ] **T8.2 — Free tier attempting product creation**
  ```bash
  # Login as a free-tier user
  curl -X POST $BASE/products \
    -H "Authorization: Bearer <free-tier-token>" \
    -F 'payload={"name":"test","description":"test test test","category_id":1,"price":{"type":"retail_price","amount":100,"currency":"ZAR"},"location":{"country":"ZA"},"contacts":[{"email":"t@t.com"}]}'
  ```
  - Verify: HTTP 403 with `FORBIDDEN` (token missing `products:create` ability)

- [ ] **T8.3 — Non-leaf category**
  ```bash
  # Use a parent category ID (one that has children)
  curl -X POST $BASE/products \
    -H "Authorization: Bearer $TOKEN" \
    -F 'payload={
      "name": "Test",
      "description": "Testing non-leaf category validation",
      "category_id": <parent-category-id>,
      "price": {"type": "retail_price", "amount": 100, "currency": "ZAR"},
      "location": {"country": "ZA"},
      "contacts": [{"email": "t@t.com"}]
    }'
  ```
  - Verify: HTTP 422 with `"The category must be a leaf category"`

- [ ] **T8.4 — Edit another user's product**
  ```bash
  # Try to update a product you don't own
  curl -X PUT $BASE/products/<someone-elses-slug> \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name": "Hijacked!"}'
  ```
  - Verify: HTTP 403 with `"You do not own this product."`

- [ ] **T8.5 — Rate limit test**
  ```bash
  # Send many rapid requests (adjust count based on your tier's limit)
  for i in $(seq 1 35); do
    curl -s -o /dev/null -w "%{http_code}\n" $BASE/products \
      -H "Authorization: Bearer $TOKEN"
  done
  ```
  - Verify: Eventually returns 429 status codes

---

### Phase 9: Agent Delegation (if agent account available)

> Skip this phase if you don't have an agent account set up yet.

- [ ] **T9.1 — Login as agent**
  ```bash
  curl -X POST $BASE/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "<agent-email>",
      "password": "<agent-password>",
      "device_name": "Agent Testing"
    }'
  ```
  - Verify: `account_type` is `"agent"`, `abilities` includes `agents:delegate`
  - Save: `export AGENT_TOKEN="<token>"`

- [ ] **T9.2 — List delegations**
  ```bash
  curl $BASE/agents/delegations -H "Authorization: Bearer $AGENT_TOKEN"
  ```
  - Verify: Returns list of sellers with quota info
  - Note down: A `seller_id` with remaining product quota

- [ ] **T9.3 — View specific delegation**
  ```bash
  curl $BASE/agents/delegations/<seller-id> \
    -H "Authorization: Bearer $AGENT_TOKEN"
  ```
  - Verify: Returns delegation details with abilities and quota

- [ ] **T9.4 — Write without X-On-Behalf-Of (should fail)**
  ```bash
  curl -X POST $BASE/products \
    -H "Authorization: Bearer $AGENT_TOKEN" \
    -F 'payload={"name":"Test","description":"Agent test product","category_id":1,"price":{"type":"retail_price","amount":100,"currency":"ZAR"},"location":{"country":"ZA"},"contacts":[{"email":"t@t.com"}]}'
  ```
  - Verify: HTTP 400 with `DELEGATION_REQUIRED`

- [ ] **T9.5 — Create product on behalf of seller**
  ```bash
  curl -X POST $BASE/products \
    -H "Authorization: Bearer $AGENT_TOKEN" \
    -H "X-On-Behalf-Of: <seller-id>" \
    -H "Idempotency-Key: agent-test-$(date +%s)" \
    -F 'payload={
      "name": "Agent-Created Test Product",
      "description": "This product was created by an AI agent on behalf of a seller. Testing the delegation system.",
      "category_id": <leaf-category-id>,
      "price": {"type": "retail_price", "amount": 25000, "currency": "ZAR"},
      "location": {"country": "ZA", "city": "Johannesburg"},
      "contacts": [{"name": "Seller Contact", "email": "seller@example.com"}]
    }'
  ```
  - Verify: HTTP 201, product is created under the seller's account
  - Verify: The product appears in the seller's product list (not the agent's)

- [ ] **T9.6 — Delegate to non-existent seller**
  ```bash
  curl -X POST $BASE/products \
    -H "Authorization: Bearer $AGENT_TOKEN" \
    -H "X-On-Behalf-Of: 999999" \
    -F 'payload={"name":"Test","description":"Testing invalid delegation","category_id":1,"price":{"type":"retail_price","amount":100,"currency":"ZAR"},"location":{"country":"ZA"},"contacts":[{"email":"t@t.com"}]}'
  ```
  - Verify: HTTP 403 with `DELEGATION_DENIED`

- [ ] **T9.7 — Regular user trying agent endpoints**
  ```bash
  curl $BASE/agents/delegations -H "Authorization: Bearer $TOKEN"
  ```
  - Verify: HTTP 403 with `"Only agent accounts can access delegations."`

---

### Phase 10: Cleanup

- [ ] **T10.1 — Delete all test products**
  ```bash
  # List your products
  curl $BASE/users/me/products -H "Authorization: Bearer $TOKEN"

  # Delete each test product
  curl -X DELETE $BASE/products/<slug> -H "Authorization: Bearer $TOKEN"
  ```

- [ ] **T10.2 — Logout**
  ```bash
  curl -X POST $BASE/auth/logout -H "Authorization: Bearer $TOKEN"
  ```
  - Verify: HTTP 204

- [ ] **T10.3 — Confirm token is invalidated**
  ```bash
  curl $BASE/users/me -H "Authorization: Bearer $TOKEN"
  ```
  - Verify: HTTP 401

---

### Test Results Summary

| Phase | Description | Pass/Fail | Notes |
|-------|-------------|-----------|-------|
| 1 | Infrastructure & Public | | |
| 2 | Authentication | | |
| 3 | User Profile | | |
| 4 | Product CRUD | | |
| 5 | Status Transitions | | |
| 6 | Idempotency | | |
| 7 | Search & Filtering | | |
| 8 | Error Handling | | |
| 9 | Agent Delegation | | |
| 10 | Cleanup | | |

**Tested by:** _________________________ **Date:** _____________