# Zaykaa API Contracts & Design Specifications

All Zaykaa REST API endpoints follow uniform naming conventions, HTTP status standards, and predictable JSON envelope schemas.

All API routes are prefixed with `/api`.

---

## 1. Response Envelopes & Error Conventions

Every API endpoint responds with one of two standard JSON envelopes.

### A. Success Envelope (`2xx`)
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional human-readable success description",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 42
  }
}
```

### B. Error Envelope (`4xx` / `5xx`)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Specific explanation of the failure",
    "details": [ ... ]
  }
}
```

### Standard Error Codes
| Error Code | HTTP Status | Meaning |
| :--- | :--- | :--- |
| `VALIDATION_ERROR` | `400 Bad Request` | Missing or malformed request parameters/body |
| `UNAUTHORIZED` | `401 Unauthorized` | Missing, invalid, or expired JWT token |
| `FORBIDDEN` | `403 Forbidden` | Authenticated user lacks required role or resource ownership |
| `NOT_FOUND` | `404 Not Found` | Target endpoint or resource does not exist |
| `CONFLICT` | `409 Conflict` | State conflict (e.g., duplicate email, order already claimed) |
| `INVALID_STATE_TRANSITION`| `400 Bad Request` | Attempted order transition violates the canonical state machine |
| `INTERNAL_SERVER_ERROR` | `500 Server Error` | Unexpected unhandled server exception |

---

## 2. Authentication & Authorization Header

Protected endpoints require a Bearer token in the HTTP `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

The decoded JWT payload contains:
```json
{
  "userId": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "email": "kunal@example.com",
  "role": "customer",
  "iat": 1729938000,
  "exp": 1730024400
}
```

---

## 3. Implemented vs. Planned Endpoints Summary

### A. Implemented Endpoint (Prompt 1.0)
| Method | Endpoint | Description | Status Code | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health and operational status check | `200 OK` | Public |

**Response (`200 OK`):**
```json
{
  "success": true,
  "message": "Zaykaa API is running"
}
```

---

## 4. Planned Endpoint Specifications

### A. Authentication Module (`/api/auth`) — Shared

#### 1. Register User
- **Method & Path:** `POST /api/auth/register`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "name": "Kunal Sood",
    "email": "kunal@example.com",
    "password": "SecurePassword123!",
    "phone": "+91 98765 43210",
    "role": "customer"
  }
  ```
  *(Role must be one of: `"customer"`, `"restaurant"`, `"delivery"`)*
- **Success Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "name": "Kunal Sood",
        "email": "kunal@example.com",
        "phone": "+91 98765 43210",
        "role": "customer",
        "createdAt": "2026-10-26T11:00:00.000Z"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    },
    "message": "Registration successful"
  }
  ```
- **Errors:** `400 VALIDATION_ERROR`, `409 CONFLICT` (email already exists).

#### 2. Login User
- **Method & Path:** `POST /api/auth/login`
- **Access:** Public
- **Request Body:**
  ```json
  {
    "email": "kunal@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "name": "Kunal Sood",
        "email": "kunal@example.com",
        "role": "customer"
      },
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    },
    "message": "Login successful"
  }
  ```
- **Errors:** `400 VALIDATION_ERROR`, `401 UNAUTHORIZED` (invalid credentials).

#### 3. Get Current User Profile
- **Method & Path:** `GET /api/auth/me`
- **Access:** Authenticated (`customer`, `restaurant`, `delivery`)
- **Success Response (`200 OK`):** Returns the authenticated user entity (`passwordHash` omitted).

---

### B. Customer Module (`/api/customers`) — Member 1 (M1)

#### 1. Get Customer Profile
- **Method & Path:** `GET /api/customers/profile`
- **Access:** Role: `customer`
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "name": "Kunal Sood",
      "email": "kunal@example.com",
      "phone": "+91 98765 43210",
      "savedAddress": {
        "street": "123 Tech Park Road",
        "city": "Bengaluru",
        "pincode": "560100"
      }
    }
  }
  ```

#### 2. Update Customer Profile
- **Method & Path:** `PUT /api/customers/profile`
- **Access:** Role: `customer`
- **Request Body:** `{ "name": "...", "phone": "...", "savedAddress": { ... } }`
- **Success Response (`200 OK`):** Updated profile.

#### 3. List Customer Orders
- **Method & Path:** `GET /api/customers/orders`
- **Access:** Role: `customer`
- **Success Response (`200 OK`):** Array of orders belonging to authenticated `customerId`, sorted descending by `createdAt`.

---

### C. Restaurant & Menu Modules (`/api/restaurants`) — Member 2 (M2)

#### 1. List Restaurants (Discovery)
- **Method & Path:** `GET /api/restaurants`
- **Access:** Public
- **Query Params:** `?search=tandoori&cuisine=North+Indian`
- **Success Response (`200 OK`):** Array of active restaurants matching criteria.

#### 2. Get Single Restaurant
- **Method & Path:** `GET /api/restaurants/:id`
- **Access:** Public
- **Success Response (`200 OK`):** Single restaurant profile.

#### 3. Create Restaurant Profile
- **Method & Path:** `POST /api/restaurants`
- **Access:** Role: `restaurant` (must not already have a restaurant in CE-1)
- **Request Body:** `{ "name": "...", "description": "...", "cuisineTypes": [...], "address": {...}, "phone": "...", "imageUrl": "..." }`
- **Success Response (`201 Created`):** Created restaurant object.

#### 4. Update Restaurant Profile
- **Method & Path:** `PUT /api/restaurants/:id`
- **Access:** Role: `restaurant` (must own `restaurant.ownerId`)
- **Request Body:** Partial or complete profile fields, including `"isOpen": true|false`.
- **Success Response (`200 OK`):** Updated restaurant object.

#### 5. List Restaurant Menu
- **Method & Path:** `GET /api/restaurants/:id/menu`
- **Access:** Public
- **Success Response (`200 OK`):** Array of menu items belonging to `restaurantId`.

#### 6. Add Menu Item
- **Method & Path:** `POST /api/restaurants/:id/menu`
- **Access:** Role: `restaurant` (must own restaurant)
- **Request Body:**
  ```json
  {
    "name": "Paneer Butter Masala",
    "description": "Rich tomato and cashew gravy.",
    "category": "Main Course",
    "price": 28000,
    "imageUrl": "/assets/images/menu/paneer.jpg"
  }
  ```
- **Success Response (`201 Created`):** Created `MenuItem` object with price in paise.

#### 7. Update Menu Item
- **Method & Path:** `PUT /api/restaurants/:id/menu/:itemId`
- **Access:** Role: `restaurant` (must own restaurant)
- **Request Body:** Fields to update (`name`, `description`, `category`, `price`, `imageUrl`).
- **Success Response (`200 OK`):** Updated `MenuItem`.

#### 8. Toggle Menu Item Availability
- **Method & Path:** `PATCH /api/restaurants/:id/menu/:itemId/availability`
- **Access:** Role: `restaurant` (must own restaurant)
- **Request Body:** `{ "isAvailable": false }`
- **Success Response (`200 OK`):** Updated `MenuItem`.

#### 9. Delete Menu Item
- **Method & Path:** `DELETE /api/restaurants/:id/menu/:itemId`
- **Access:** Role: `restaurant` (must own restaurant)
- **Success Response (`200 OK`):** `{ "success": true, "message": "Menu item deleted" }`.

---

### D. Shared Order Module (`/api/orders`) — Shared Ownership

#### 1. Place Order (Checkout) — Owned by M1
- **Method & Path:** `POST /api/orders`
- **Access:** Role: `customer`
- **Request Body:**
  ```json
  {
    "restaurantId": "rst_4a7c1b23-8e9f-4321-a012-3456789abcde",
    "items": [
      { "itemId": "item_f1e2d3c4-b5a6-4789-8012-3456789abcde", "quantity": 2 },
      { "itemId": "item_a9b8c7d6-e5f4-4321-8765-123456789abc", "quantity": 3 }
    ],
    "deliveryAddress": {
      "street": "123 Tech Park Road",
      "city": "Bengaluru",
      "pincode": "560100"
    }
  }
  ```
- **Backend Mechanics:** Server looks up menu items, verifies single-restaurant origin, confirms availability, recalculates total in paise, snapshots names/prices, sets `status = "Placed"`, and saves order.
- **Success Response (`201 Created`):** Returns canonical `Order` entity.
- **Errors:** `400 VALIDATION_ERROR`, `400 ITEM_UNAVAILABLE`, `400 RESTAURANT_CLOSED`.

#### 2. Get Order Details — Shared
- **Method & Path:** `GET /api/orders/:id`
- **Access:** Authenticated. Customer who placed it, Restaurant owner whose restaurant is fulfilling it, or assigned Delivery Partner.
- **Success Response (`200 OK`):** Returns canonical `Order` entity.
- **Errors:** `403 FORBIDDEN` if caller is not an authorized party.

#### 3. Get Restaurant Incoming Orders — Owned by M2
- **Method & Path:** `GET /api/orders/restaurant/:restaurantId`
- **Access:** Role: `restaurant` (must own `restaurantId`)
- **Success Response (`200 OK`):** Array of orders for the restaurant, sorted descending by `createdAt`.

#### 4. Update Preparation Status (Restaurant Transitions) — Owned by M2
- **Method & Path:** `PATCH /api/orders/:id/status`
- **Access:** Role: `restaurant` (must own `order.restaurantId`)
- **Request Body:**
  ```json
  {
    "status": "Accepted"
  }
  ```
  *(Allowed target statuses: `"Accepted"`, `"Preparing"`, `"Ready for Pickup"`, `"Rejected"`)*
- **Success Response (`200 OK`):** Returns updated `Order` entity.
- **Errors:** `400 INVALID_STATE_TRANSITION`, `403 FORBIDDEN`.

#### 5. Cancel Order (Customer Cancellation) — Owned by M1
- **Method & Path:** `POST /api/orders/:id/cancel`
- **Access:** Role: `customer` (must own `order.customerId`)
- **Request Body:** `{ "reason": "Placed by mistake" }` (optional)
- **Validation:** Permitted only when `order.status` is `"Placed"` or `"Accepted"`. If status is `"Preparing"` or later, returns `400 CANCELLATION_DISALLOWED_PREPARATION_STARTED`.
- **Success Response (`200 OK`):** Returns updated `Order` entity with `status = "Cancelled"`.

---

### E. Delivery Partner Module (`/api/partners`) — Member 2 (M2)

#### 1. Delivery Dashboard & Pool Overview
- **Method & Path:** `GET /api/partners/dashboard`
- **Access:** Role: `delivery`
- **Success Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "partner": {
        "id": "del_e8f7a6b5-c4d3-4210-9876-543210fedcba",
        "isAvailable": true,
        "totalDeliveries": 18,
        "activeOrderId": "ord_10293847-5678-4321-abcd-ef0123456789"
      },
      "activeOrder": { ... },
      "availableOrders": [ ... ]
    }
  }
  ```

#### 2. Toggle Partner Availability
- **Method & Path:** `PATCH /api/partners/availability`
- **Access:** Role: `delivery`
- **Request Body:** `{ "isAvailable": true|false }`
- **Success Response (`200 OK`):** Updated partner profile.

#### 3. Accept Delivery Assignment (Claim Order)
- **Method & Path:** `PATCH /api/partners/orders/:id/accept`
- **Access:** Role: `delivery`
- **Validation:** Partner must have `activeOrderId === null` and `isAvailable === true`. Order must have `deliveryPartnerId === null` and status in `["Accepted", "Preparing", "Ready for Pickup"]`.
- **Concurrency Protection:** Handled via storage write lock. If already claimed, returns `409 CONFLICT`.
- **Success Response (`200 OK`):** Returns assigned `Order`. Note: `order.status` remains unchanged.

#### 4. Confirm Package Pickup
- **Method & Path:** `PATCH /api/partners/orders/:id/pickup`
- **Access:** Role: `delivery` (assigned partner)
- **Validation:** Permitted only when `order.status === "Ready for Pickup"`.
- **Success Response (`200 OK`):** Returns order with `status = "Picked Up"`.

#### 5. Mark Out for Delivery
- **Method & Path:** `PATCH /api/partners/orders/:id/out-for-delivery`
- **Access:** Role: `delivery` (assigned partner)
- **Validation:** Permitted only when `order.status === "Picked Up"`.
- **Success Response (`200 OK`):** Returns order with `status = "Out for Delivery"`.

#### 6. Confirm Order Delivery
- **Method & Path:** `PATCH /api/partners/orders/:id/deliver`
- **Access:** Role: `delivery` (assigned partner)
- **Validation:** Permitted only when `order.status === "Out for Delivery"`.
- **Side Effects:** Sets `order.status = "Delivered"`, resets `partner.activeOrderId = null`, increments `partner.totalDeliveries += 1`.
- **Success Response (`200 OK`):** Returns order with `status = "Delivered"`.
