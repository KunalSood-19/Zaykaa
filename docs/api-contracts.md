# Zaykaa API Contracts & Design Specifications

All Zaykaa REST API endpoints follow uniform naming conventions, HTTP status standards, and predictable JSON envelope schemas.

All API routes are prefixed with `/api`.

---

## 1. Response Envelopes

Every API endpoint must respond with one of the two standard JSON envelopes.

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

- `success`: Always `true`
- `data`: The requested entity or collection (omitted for simple status messages)
- `message`: Optional status string
- `meta`: Optional pagination or query metadata

### B. Error Envelope (`4xx` / `5xx`)

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Specific explanation of the failure",
    "details": [ ... ]
  }
}
```

- `success`: Always `false`
- `error.code`: Standard machine-readable error token (e.g., `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `INTERNAL_SERVER_ERROR`)
- `error.message`: Human-readable error description
- `error.details`: Optional array of field-level validation errors

---

## 2. HTTP Method & Status Code Conventions

| HTTP Method | Typical Scenario | Success Status | Error Statuses |
| :--- | :--- | :--- | :--- |
| **GET** | Retrieve a single resource or collection | `200 OK` | `404 Not Found`, `401 Unauthorized` |
| **POST** | Create a new resource or execute an action | `201 Created` / `200 OK` | `400 Bad Request`, `422 Unprocessable Entity` |
| **PUT** | Replace an existing resource completely | `200 OK` | `400 Bad Request`, `404 Not Found` |
| **PATCH** | Partially update a resource (e.g., order status) | `200 OK` | `400 Bad Request`, `404 Not Found` |
| **DELETE** | Remove an existing resource | `200 OK` / `204 No Content` | `404 Not Found`, `403 Forbidden` |

---

## 3. Implemented vs. Planned Endpoints Summary

> [!NOTE]
> Currently in **Prompt 1.0 (Initialization)**: Only the health check endpoint is implemented. All other endpoints listed below are planned for subsequent development phases.

### A. Implemented Endpoints

| Method | Endpoint | Description | Status Code | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Health and operational status check | `200 OK` | Public |

**Implementation Response:**
```json
{
  "success": true,
  "message": "Zaykaa API is running"
}
```

---

### B. Planned Endpoint Groups & Team Ownership

#### 1. Authentication Module (`/api/auth`) — Shared
| Method | Endpoint | Description | Access | Owner |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user (customer, restaurant, delivery) | Public | Shared |
| `POST` | `/api/auth/login` | Authenticate user and issue JWT | Public | Shared |
| `GET` | `/api/auth/me` | Fetch profile of authenticated user | Authenticated | Shared |

#### 2. Customer Module (`/api/customers`) — Member 1 (M1)
| Method | Endpoint | Description | Access | Owner |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/customers/profile` | Get customer profile & saved addresses | Customer | M1 |
| `PUT` | `/api/customers/profile` | Update customer profile & addresses | Customer | M1 |
| `GET` | `/api/customers/orders` | Fetch customer's past and current orders | Customer | M1 |

#### 3. Restaurant & Menu Modules (`/api/restaurants`) — Member 2 (M2)
| Method | Endpoint | Description | Access | Owner |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/restaurants` | List restaurants (search, filters, cuisines) | Public | M1 (Frontend) / M2 (Backend) |
| `GET` | `/api/restaurants/:id` | Get single restaurant details | Public | M2 |
| `POST` | `/api/restaurants` | Register/create restaurant profile | Restaurant Owner | M2 |
| `PUT` | `/api/restaurants/:id` | Update restaurant profile / operational status | Restaurant Owner | M2 |
| `GET` | `/api/restaurants/:id/menu` | List menu categories & items for restaurant | Public | M2 |
| `POST` | `/api/restaurants/:id/menu` | Add item to restaurant menu | Restaurant Owner | M2 |
| `PUT` | `/api/restaurants/:id/menu/:itemId`| Update menu item details or pricing | Restaurant Owner | M2 |
| `PATCH`| `/api/restaurants/:id/menu/:itemId/availability` | Toggle item in-stock status | Restaurant Owner | M2 |
| `DELETE`| `/api/restaurants/:id/menu/:itemId` | Remove menu item | Restaurant Owner | M2 |

#### 4. Shared Order Module (`/api/orders`) — Shared Ownership
| Method | Endpoint | Description | Access | Owner |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/orders` | Create and place a new order | Customer | M1 |
| `GET` | `/api/orders/:id` | Get order details by ID | Customer / Restaurant / Delivery | Shared |
| `GET` | `/api/orders/restaurant/:restaurantId` | Get incoming orders for a restaurant | Restaurant Owner | M2 |
| `PATCH`| `/api/orders/:id/status` | Update order status (accept/prep/transit) | Restaurant / Delivery | M2 |
| `POST` | `/api/orders/:id/cancel` | Cancel an order before preparation | Customer / Restaurant | Shared |

#### 5. Delivery Partner Module (`/api/partners`) — Member 2 (M2)
| Method | Endpoint | Description | Access | Owner |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/partners/dashboard` | Get active available pickups & earnings | Delivery Partner | M2 |
| `PATCH`| `/api/partners/orders/:id/accept` | Accept an available delivery assignment | Delivery Partner | M2 |
| `PATCH`| `/api/partners/orders/:id/pickup` | Confirm pickup of ready order | Delivery Partner | M2 |
| `PATCH`| `/api/partners/orders/:id/deliver` | Confirm drop-off and mark delivered | Delivery Partner | M2 |

---

## 4. Canonical Order Schema Contract

```json
{
  "id": "ord_102938475",
  "customerId": "cust_8829",
  "customerName": "Tarshit Gupta",
  "customerPhone": "+91 98765 43210",
  "restaurantId": "rest_001",
  "restaurantName": "Spice Symphony",
  "deliveryPartnerId": "deliv_402",
  "status": "Placed",
  "items": [
    {
      "itemId": "menu_12",
      "name": "Paneer Butter Masala",
      "quantity": 2,
      "price": 280
    }
  ],
  "pricing": {
    "subtotal": 560,
    "deliveryFee": 40,
    "tax": 28,
    "total": 628
  },
  "deliveryAddress": {
    "street": "123 Tech Park Road",
    "city": "Bengaluru",
    "pincode": "560100"
  },
  "timestamps": {
    "createdAt": "2026-10-26T10:55:00.000Z",
    "updatedAt": "2026-10-26T10:55:00.000Z"
  }
}
```

### Order Status Lifecycle States
- `Placed` (Initial customer order state)
- `Accepted` (Restaurant confirms order)
- `Preparing` (Kitchen is preparing food)
- `Ready for Pickup` (Packaging complete)
- `Picked Up` (Delivery partner has possession)
- `Out for Delivery` (Delivery partner en route to customer)
- `Delivered` (Order successfully completed)
- `Rejected` (Restaurant declines order)
- `Cancelled` (Customer cancels before preparation starts)
