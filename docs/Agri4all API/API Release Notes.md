# Agri4All API v1 - Release Notes

**Date:** March 2026
**Version:** v1
**Status:** Ready for launch

---

## Welcome - What is the API?

Until now, the only way to use Agri4All was through the website - manually creating products, uploading photos, and managing listings one by one. The API changes that.

The Agri4All API is a way for software - including AI agents - to do everything the website does, but automatically and at scale. This gives a program or an AI agent the ability to log in, create product listings, upload images, manage pricing, and search the marketplace, all without anyone clicking through web pages.

In plain terms: instead of a person sitting at a computer filling in product forms, an AI agent can do it hundreds of times a day, across multiple sellers, without mistakes or fatigue.

---

## What Can It Do?

### For Sellers (via AI Agents)
- **Create product listings automatically** - An AI agent can create a complete listing (title, description, pricing, photos, category-specific fields) in a single request
- **Manage products for multiple sellers** - One agent can handle listings for many different sellers, each with their own account and subscription
- **Handle rejections intelligently** - When admin review rejects a listing, the agent can read the rejection reason, fix the issue, and resubmit
- **Upload photos and documents** - Product images and PDF catalogues can be attached during creation or added afterward
- **Track product status** - See which products are approved, pending review, rejected, sold, or archived
- **Monitor quotas** - Check how many product slots a seller has remaining on their subscription tier

### For the Marketplace
- **Search products** - Full-text search powered by Meilisearch with filters for category, country, price range, and geographic radius
- **Browse categories** - Hierarchical category tree with category-specific field definitions (e.g., tractors have "engine hours" and "horsepower" fields)
- **View seller profiles** - Public profiles with product counts and social links
- **Check platform health** - A health endpoint confirms the API and all its services (database, search, storage) are operational

### For User Management
- **Register and authenticate** - Create accounts and obtain secure access tokens
- **Manage profiles** - Update personal details, upload avatars, manage social links
- **View subscription details** - Check tier, quota usage, and billing period

---

## Who Is It For?

### Phase 1 (This Launch)
The primary user is an **internal AI agent** that manages product listings on behalf of multiple sellers. This is the "delegation model" - a single agent account is authorized to act on behalf of specific sellers, creating and managing their listings at scale.

**Target:** 500 product listings per day, per agent.

### Future Phases
- **Phase 1.5:** Auto-approval workflows to reduce the admin review bottleneck as volume grows
- **Phase 2:** Open and monetize the API to third-party developers and large agricultural suppliers for direct integration
- **Phase 3:** Bulk operations, analytics endpoints, client SDKs, and OAuth2 for external developer access

---

## Key Highlights

### Scale
- **49 countries** across Africa, the Middle East, Europe, and the Americas
- **41 currencies** supported for product pricing
- **Hierarchical categories** with dynamic, category-specific fields (a tractor listing captures different data than a livestock listing)
- Designed for **500+ products/day** per agent, with room to scale by adding more agents

### Security
- **Six-layer security stack** on every request: token validation, ability checks, delegation verification, ownership checks, subscription limits, and rate limiting
- **Bearer token authentication** with 30-day expiry and scoped abilities per subscription tier
- **Delegation model** - agents never store seller passwords; they operate via audited, revocable delegation grants with granular ability controls
- **Full audit trail** - every agent action logs both the agent identity and the seller being acted for

### Reliability
- **Idempotency keys** - safe retries on network failures without creating duplicate listings
- **Health monitoring** - pre-flight checks before batch operations
- **Token bucket rate limiting** - handles bursty workloads (batch product creation) better than strict per-minute counters
- **Structured error responses** - every error includes a machine-readable code, human-readable message, and unique request ID for debugging

### Multi-Country Support
- Products can be listed in any of the 49 supported countries
- Search supports geographic radius filtering (find products within X km of a location)
- Subscription tiers control how many countries a seller can operate in (from 1 to all 49 African countries)

---

## What's Coming Next

### Phase 1.5 - Smarter Approvals
As AI agent volume grows, manual admin review becomes a bottleneck. Phase 1.5 introduces:
- **Trust levels** for agents and sellers based on approval history
- **Auto-approval rules** for complete, high-quality listings from trusted sources
- **Webhooks** to notify agents of status changes (no more polling)

### Phase 2 - Developer Access
- Self-service developer portal with API key management
- Per-seller API tokens (sellers manage their own access directly)
- Webhooks for external systems
- Public documentation site

### Phase 3 - Advanced Features
- Bulk import/update operations
- Analytics endpoints (views, inquiries, search trends)
- Auto-generated client SDKs (PHP, Python, JavaScript)
- OAuth2 for third-party "act on behalf of user" flows

---

## Want to Dig Deeper?

The **API-GUIDE.md** is a hands-on, step-by-step walkthrough of every API feature. It's designed to be followed in order - each section builds on the previous one. Start there if you want to understand how the API works in practice.

---

---

## Technical Deep Dive (For Daniel)

> This section is for the person who will be working through the API-GUIDE.md and building/configuring the AI agent. It covers architecture, the delegation model, agent workflows, and operational details.

### Architecture Overview

The API is a **thin layer on top of the existing Agri4All application**. It does not duplicate business logic - all product creation, pricing, contact management, media handling, and search use the same services that power the website. The API adds: authentication, delegation resolution, idempotency, rate limiting, request validation, and response transformation.

```
Client (AI Agent)
    |
    v
  /api/v1/* routes
    |
    v
  Middleware Stack
  |-- Sanctum Token Auth
  |-- Token Ability Check
  |-- ResolveActingUser (agent delegation)
  |-- IdempotencyMiddleware (write operations)
  |-- Rate Limiting (token bucket, tier-based)
  |-- API Exception Handler
    |
    v
  API Controllers (thin orchestrators)
    |
    v
  Existing Services & Models
  (ProductService, ContactService, LocationService, MediaService, PriceService)
    |
    v
  API Resources (response transformation)
    |
    v
  JSON Response
```

### The Delegation Model

This is the core concept for agent operations. Understanding it is essential.

**How it works:**
1. An "agent" is a user account with `account_type = 'agent'`
2. Admins create **delegations** linking an agent to specific sellers, with specific abilities (e.g., "this agent can create and update products for seller #7")
3. When the agent makes a request, it includes `X-On-Behalf-Of: 7` to specify which seller it's acting for
4. The `ResolveActingUser` middleware verifies the delegation exists, is active, and includes the required ability
5. From that point on, `$request->actingUser()` returns the **seller**, not the agent - so all business logic (quotas, ownership, etc.) applies to the seller

**Why this design:**
- The agent never needs seller passwords
- Delegations are granular (per-seller, per-ability) and revocable
- Quotas and limits apply to the seller's subscription tier, not the agent
- Full audit trail: every action logs both agent ID and seller ID

**Delegation abilities:**
```
products:read, products:create, products:update, products:delete, products:media
categories:read, users:read, search:products, agents:delegate
```

Each delegation can grant a subset of these. The agent's token must have the ability AND the delegation must grant it for that seller - two-layer check.

### Agent Workflows (Summary)

The key flows are:

1. **Create a Complete Product** - Check seller quota, get category fields, create product with media (multipart), verify response
2. **Batch Product Creation** - Fetch all delegations, cache categories, loop through products with idempotency keys, handle errors per product
3. **Handle Rejected Products** - List rejected products per seller, read rejection reasons, fix and resubmit with `rejected_pending` status
4. **Monitor Product Portfolio** - Check products by status, get quota usage from subscription endpoint
5. **Pre-flight Health Check** - Verify API and services are operational before starting a batch

### Rate Limiting Details

| Tier | Sustained/Min | Burst | Daily Limit |
|------|---------------|-------|-------------|
| Unauthenticated | 15 | 15 | 500 |
| Farm Sprout (Free) | 30 | 45 | 1,000 |
| Farm Savvy/Vital | 60 | 90 | 5,000 |
| Farm Prime | 120 | 180 | 20,000 |
| Farm Elite | 200 | 300 | 50,000 |
| Farm Master | 300 | 450 | 100,000 |
| Agent (internal) | 300 | 500 | 100,000 |

**Token bucket:** The bucket starts full at the burst limit. Each request removes one token. Tokens refill at the sustained rate. An agent can burst 500 requests immediately, then must sustain at 300/min (5/second).

**Important:** Agent rate limits are per-agent, not per-seller. One agent acting for 10 sellers shares a single 300/min bucket. To increase throughput, spin up additional agents.

### Idempotency

All write operations support an `Idempotency-Key` header. This is critical for reliability at scale:
- First request with a key: processed normally, response cached 24 hours
- Same key, same payload: returns cached response without re-executing
- Same key, different payload: returns `409 IDEMPOTENCY_CONFLICT`
- Keys are scoped to the acting user (the seller)

**Recommended key format:** `idem_` + deterministic hash of product data (e.g., `idem_` + SHA-256 of `seller_id + name + category_id`)

### Product Creation - Two Options

**Option A: JSON (media separate)**
1. `POST /products` with JSON body
2. `POST /products/{slug}/media` with multipart files

**Option B: Multipart (atomic, recommended)**
1. Single `POST /products` with `payload` (JSON string) + `media[]` (files)
2. If any media fails validation, the entire request is rejected (no partial state)

Option B is recommended because it reduces API calls and eliminates partial failure states.

### Product Status Lifecycle

```
Created (POST /products)
    |
    v
  PENDING --- admin reviews ---> APPROVED (visible publicly)
    |                               |
    |                               |-> SOLD (owner marks)
    |                               |     |-> ARCHIVED
    |                               |-> ARCHIVED
    |
    |-- admin reviews ---> REJECTED
                              |
                              |-> REJECTED_PENDING (owner fixes & resubmits)
                                    |
                                    |-- admin approves ---> APPROVED
                                    |-- admin rejects  ---> FINALLY_REJECTED (terminal)
```

**Key for agents:** Products created via API go directly to `PENDING` (bypassing the `INCOMPLETE` web wizard state). When resubmitting a rejected product, use `rejected_pending` - not `pending`.

### Subscription Tiers and Quotas

| Tier | Products/Month | Countries | API Write Access |
|------|---------------|-----------|-----------------|
| Farm Sprout (Free) | 2 | 1 | No (read-only) |
| Farm Savvy | 10 | 1 | Yes |
| Farm Vital | 10 | 1 | Yes |
| Farm Prime | 30 | 1 | Yes |
| Farm Elite | Unlimited | 5 | Yes |
| Farm Master | Unlimited | 49 (all) | Yes |

**Quota resets on the 1st of each month.** Every creation attempt counts, regardless of eventual status (prevents create-and-delete gaming).

### Error Handling Strategy

| Status | Agent Action |
|--------|-------------|
| 2xx | Success. Proceed. |
| 400 | Bug in agent logic (missing header, bad JSON). Fix and don't retry as-is. |
| 401 | Token expired. Re-authenticate and retry. |
| 403 QUOTA_EXCEEDED | Seller at limit. Skip seller, move to next. |
| 403 DELEGATION_DENIED | Configuration issue. Alert human. |
| 404 | Resource not found. Slug may have changed - search first. |
| 409 | Idempotency conflict. Original request likely succeeded. Fetch resource to confirm. |
| 422 | Validation failure. Read `error.details`, fix data, retry (max 3 attempts). |
| 429 | Rate limited. Wait `Retry-After` seconds. Never retry immediately. |
| 500 | Server error. Retry with exponential backoff (2s, 4s, 8s), max 3 retries. |
| 503 | Service unavailable. Check health endpoint. Wait 30-60s before retry. |

### Capacity Planning

At 500 products/day using multipart creation (1 request per product):
- ~1,500-2,000 total requests/day (including quota checks, category fetches, retries)
- Well within the 100,000 daily limit
- ~3 minutes of active API time at sustained rate
- Scale by adding more agent accounts with independent rate limits

### Getting Started

1. Read through the **API-GUIDE.md** - it's designed to be followed in order, section by section
2. Use the **staging environment** (`https://alpha.agri4all.com/api/v1`) for all testing
3. The interactive API docs are at `https://alpha.agri4all.com/docs/api` and are only accessible to authenticated users (only Daniel and Garth at this stage)
4. The health endpoint (`GET /api/v1/health`) is the first thing to verify
5. An agent account needs to be set up by Garth first before the agent can operate
6. Thereafter, any admin can delegate any seller to any agent 
