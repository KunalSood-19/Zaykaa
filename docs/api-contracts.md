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

---

## 5. Canonical Domain Schemas

To maintain architectural cohesion between Member 1 (Customer & Ordering) and Member 2 (Restaurant & Delivery), all modules share the following canonical domain schemas:

### A. Customer Model (`backend/data/customers.json`)
```json
{
  "id": "cust_8829",
  "name": "Tarshit Gupta",
  "email": "tarshit@example.com",
  "phone": "+91 98765 43210",
  "addresses": [
    {
      "id": "addr_01",
      "label": "Home",
      "street": "123 Tech Park Road",
      "city": "Bengaluru",
      "pincode": "560100",
      "isDefault": true
    }
  ],
  "createdAt": "2026-10-26T10:00:00.000Z",
  "updatedAt": "2026-10-26T10:00:00.000Z"
}
```

### B. Restaurant Model (`backend/data/restaurants.json`)
```json
{
  "id": "rest_001",
  "name": "Spice Symphony",
  "description": "Authentic North Indian and Mughlai curries crafted with traditional slow-cooking techniques.",
  "cuisines": ["North Indian", "Mughlai", "Biryani"],
  "rating": 4.6,
  "ratingCount": 380,
  "deliveryTimeEstimate": "30-40 mins",
  "costForTwo": 600,
  "isOpen": true,
  "address": {
    "street": "45 Koramangala 5th Block",
    "city": "Bengaluru",
    "pincode": "560095"
  },
  "contact": {
    "phone": "+91 98111 22233",
    "email": "contact@spicesymphony.com"
  },
  "bannerImage": "/assets/images/restaurants/spice-symphony.jpg",
  "createdAt": "2026-10-26T10:00:00.000Z",
  "updatedAt": "2026-10-26T10:00:00.000Z"
}
```

### C. Menu Item Model (`backend/data/menus.json`)
```json
{
  "itemId": "menu_12",
  "restaurantId": "rest_001",
  "name": "Paneer Butter Masala",
  "description": "Fresh cottage cheese cubes simmered in a rich tomato and butter silk gravy.",
  "price": 280,
  "category": "Main Course",
  "isVeg": true,
  "isAvailable": true,
  "imageUrl": "/assets/images/items/paneer-butter-masala.jpg",
  "createdAt": "2026-10-26T10:00:00.000Z",
  "updatedAt": "2026-10-26T10:00:00.000Z"
}
```

---

## 6. Order Lifecycle State Machine & Transition Rules

The lifecycle is strictly enforced centrally in `backend/src/modules/orders/order.service.js`.

### State Transition Matrix

| Current Status | Permitted New Statuses | Authorized Role / Actor | Precondition / Validation Rule |
| :--- | :--- | :--- | :--- |
| *(None)* | `Placed` | Customer (M1) | Server calculates authoritative prices from menu; restaurant must be open. |
| `Placed` | `Accepted` | Restaurant Owner (M2) | Kitchen confirms capacity to fulfill order. |
| `Placed` | `Rejected` | Restaurant Owner (M2) | Item out of stock or kitchen overloaded. |
| `Placed` | `Cancelled` | Customer (M1) | Customer changes mind **strictly before preparation begins**. |
| `Accepted` | `Preparing` | Restaurant Owner (M2) | Kitchen begins cooking. Customer cancellation is **disallowed** from this point. |
| `Accepted` | `Cancelled` | Customer (M1) | Allowed only if kitchen has not yet set status to `Preparing`. |
| `Preparing` | `Ready for Pickup` | Restaurant Owner (M2) | Food is packed and waiting for delivery pickup. |
| `Ready for Pickup` | `Picked Up` | Delivery Partner (M2) | Delivery partner arrives at restaurant and receives order. |
| `Picked Up` | `Out for Delivery`| Delivery Partner (M2) | Delivery partner starts transit towards customer delivery address. |
| `Out for Delivery` | `Delivered` | Delivery Partner (M2) | Order successfully handed over to customer. |
| `Delivered` | *(Terminal)* | None | No further transitions permitted. |
| `Rejected` | *(Terminal)* | None | No further transitions permitted. |
| `Cancelled` | *(Terminal)* | None | No further transitions permitted. |

---

## 7. Customer Identity & Order Access Control Specification

### A. Identity Resolution Strategy
- **Phase CE-1 (Immediate)**:
  - If `Authorization: Bearer <token>` is present, extract credentials (future JWT).
  - For local development and test automation, the server accepts an `x-customer-id` header (e.g., `cust_8829`).
  - If omitted in development, requests gracefully fall back to the default verified customer (`cust_8829`), preventing development blockers while maintaining full architectural alignment with future auth.
- **Phase CE-2 (Planned)**:
  - Authentication middleware verifies signed JWT and attaches `req.user = { id: 'cust_8829', role: 'customer' }`.

### B. Access Control & Authorization Rules
1. **Private Customer Orders (`GET /api/customers/orders`)**:
   - Strictly scopes returned orders where `order.customerId === currentCustomerId`.
2. **Order Details Access (`GET /api/orders/:id`)**:
   - An order is visible only to:
     - The customer who placed it (`order.customerId === currentCustomerId`).
     - The restaurant fulfilling it (`order.restaurantId === currentRestaurantId`).
     - The delivery partner assigned to it (`order.deliveryPartnerId === currentPartnerId`).
   - Any unauthorized access attempt returns `403 Forbidden` (`FORBIDDEN_ORDER_ACCESS`).
3. **Customer Cancellation Access (`POST /api/orders/:id/cancel`)**:
   - Allowed only if `order.customerId === currentCustomerId`.
   - Allowed only if current status is `Placed` (or before `Preparing`).
   - If status is `Preparing` or later, returns `400 Bad Request` (`ORDER_CANNOT_BE_CANCELLED`).

---

## 8. Detailed Customer-Facing API Endpoint Specifications

### 8.1 List Restaurants (Discovery)
- **Path**: `GET /api/restaurants`
- **Access**: Public
- **Query Parameters**:
  - `search` (string, optional): Case-insensitive match against restaurant name or cuisine tags.
  - `cuisine` (string, optional): Filter by specific cuisine (e.g., `North Indian`).
  - `isVeg` (boolean, optional): If `true`, returns restaurants with predominantly vegetarian offerings.
  - `sortBy` (string, optional): `rating` (descending), `deliveryTime` (ascending), `costForTwo` (ascending). Default: `rating`.
  - `page` (number, optional, default: `1`): Current page number.
  - `limit` (number, optional, default: `10`): Items per page.
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "rest_001",
        "name": "Spice Symphony",
        "cuisines": ["North Indian", "Mughlai", "Biryani"],
        "rating": 4.6,
        "ratingCount": 380,
        "deliveryTimeEstimate": "30-40 mins",
        "costForTwo": 600,
        "isOpen": true,
        "bannerImage": "/assets/images/restaurants/spice-symphony.jpg"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 1
    }
  }
  ```

---

### 8.2 Get Restaurant Details
- **Path**: `GET /api/restaurants/:id`
- **Access**: Public
- **Path Parameters**:
  - `id` (string, required): Restaurant ID (e.g., `rest_001`).
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "rest_001",
      "name": "Spice Symphony",
      "description": "Authentic North Indian and Mughlai curries...",
      "cuisines": ["North Indian", "Mughlai", "Biryani"],
      "rating": 4.6,
      "ratingCount": 380,
      "deliveryTimeEstimate": "30-40 mins",
      "costForTwo": 600,
      "isOpen": true,
      "address": {
        "street": "45 Koramangala 5th Block",
        "city": "Bengaluru",
        "pincode": "560095"
      },
      "contact": {
        "phone": "+91 98111 22233",
        "email": "contact@spicesymphony.com"
      },
      "bannerImage": "/assets/images/restaurants/spice-symphony.jpg"
    }
  }
  ```
- **Error Response (`404 Not Found`)**:
  ```json
  {
    "success": false,
    "error": {
      "code": "RESTAURANT_NOT_FOUND",
      "message": "Restaurant with ID 'rest_999' was not found"
    }
  }
  ```

---

### 8.3 Get Restaurant Menu
- **Path**: `GET /api/restaurants/:id/menu`
- **Access**: Public
- **Path Parameters**:
  - `id` (string, required): Restaurant ID (e.g., `rest_001`).
- **Query Parameters**:
  - `category` (string, optional): Filter by category (e.g., `Main Course`, `Starters`).
  - `isVeg` (boolean, optional): Filter by vegetarian items only.
  - `availableOnly` (boolean, optional, default: `true` for customer view): Exclude out-of-stock items.
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "restaurantId": "rest_001",
      "restaurantName": "Spice Symphony",
      "categories": [
        {
          "name": "Main Course",
          "items": [
            {
              "itemId": "menu_12",
              "name": "Paneer Butter Masala",
              "description": "Fresh cottage cheese cubes simmered in silk gravy.",
              "price": 280,
              "category": "Main Course",
              "isVeg": true,
              "isAvailable": true,
              "imageUrl": "/assets/images/items/paneer-butter-masala.jpg"
            }
          ]
        }
      ]
    }
  }
  ```

---

### 8.4 Create Customer Order
- **Path**: `POST /api/orders`
- **Access**: Customer
- **Headers**:
  - `Content-Type: application/json`
  - `x-customer-id: cust_8829` (or Bearer Token)
- **Request Body Contract**:
  ```json
  {
    "restaurantId": "rest_001",
    "items": [
      {
        "itemId": "menu_12",
        "quantity": 2
      }
    ],
    "deliveryAddress": {
      "street": "123 Tech Park Road",
      "city": "Bengaluru",
      "pincode": "560100"
    }
  }
  ```

#### Server-Side Validation & Calculation Rules:
1. **Client Price Tamper Protection**: The client **never** specifies prices or totals. Any prices submitted by the client are strictly ignored and replaced by authoritative values fetched from `menus.json`.
2. **Restaurant Existence & Open State**: Verifies `restaurantId` exists and `isOpen === true`.
3. **Single-Restaurant Enforcement**: All `itemId` values in `items` must belong exclusively to `restaurantId`. Mixing items from multiple restaurants is rejected.
4. **Item Availability**: Every requested `itemId` must exist in `menus.json` and have `isAvailable === true`.
5. **Quantity Sanity**: Each item quantity must be an integer between `1` and `20`.
6. **Address Validation**: `street`, `city`, and `pincode` (6 digits) are required non-empty strings.
7. **Pricing Computation Formula**:
   - `subtotal = sum(item.price * item.quantity)`
   - `tax = round(subtotal * 0.05)` (5% standard GST)
   - `deliveryFee = 40` (Flat ₹40 delivery fee for CE-1)
   - `total = subtotal + deliveryFee + tax`
8. **Initial State**: Automatically set to `Placed`. Timestamps generated by server.

- **Success Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "ord_1740000000000",
      "customerId": "cust_8829",
      "customerName": "Tarshit Gupta",
      "customerPhone": "+91 98765 43210",
      "restaurantId": "rest_001",
      "restaurantName": "Spice Symphony",
      "deliveryPartnerId": null,
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
        "createdAt": "2026-10-26T11:00:00.000Z",
        "updatedAt": "2026-10-26T11:00:00.000Z"
      }
    },
    "message": "Order placed successfully"
  }
  ```

- **Error Responses**:
  - `400 Bad Request` (`VALIDATION_ERROR`): Missing restaurantId, empty items array, invalid quantity, or incomplete address.
  - `400 Bad Request` (`RESTAURANT_CLOSED`): Restaurant is currently closed and not accepting orders.
  - `404 Not Found` (`RESTAURANT_NOT_FOUND`): Specified restaurant does not exist.
  - `404 Not Found` (`MENU_ITEM_NOT_FOUND`): Item does not exist for this restaurant.
  - `409 Conflict` (`ITEM_UNAVAILABLE`): One or more requested items are currently out of stock.

---

### 8.5 Get Customer Orders History
- **Path**: `GET /api/customers/orders`
- **Access**: Customer
- **Headers**:
  - `x-customer-id: cust_8829`
- **Query Parameters**:
  - `status` (string, optional): Filter by order status (`Placed`, `Preparing`, `Delivered`, etc.).
  - `page` (number, optional, default: `1`).
  - `limit` (number, optional, default: `10`).
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "ord_102938475",
        "customerId": "cust_8829",
        "restaurantId": "rest_001",
        "restaurantName": "Spice Symphony",
        "status": "Placed",
        "pricing": {
          "total": 628
        },
        "timestamps": {
          "createdAt": "2026-10-26T10:55:00.000Z"
        }
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 1
    }
  }
  ```

---

### 8.6 Get Order Details by ID
- **Path**: `GET /api/orders/:id`
- **Access**: Customer / Restaurant / Delivery Partner (Shared Endpoint)
- **Path Parameters**:
  - `id` (string, required): Order ID.
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
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
  }
  ```
- **Error Responses**:
  - `404 Not Found` (`ORDER_NOT_FOUND`): Order ID does not exist.
  - `403 Forbidden` (`FORBIDDEN_ORDER_ACCESS`): Authenticated user is neither the customer, assigned restaurant, nor delivery partner.

---

### 8.7 Customer Order Cancellation
- **Path**: `POST /api/orders/:id/cancel`
- **Access**: Customer
- **Headers**:
  - `x-customer-id: cust_8829`
- **Path Parameters**:
  - `id` (string, required): Order ID.
- **Request Body** (optional):
  ```json
  {
    "reason": "Changed my mind"
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "ord_102938475",
      "status": "Cancelled",
      "timestamps": {
        "updatedAt": "2026-10-26T11:15:00.000Z"
      }
    },
    "message": "Order cancelled successfully"
  }
  ```
- **Error Responses**:
  - `400 Bad Request` (`ORDER_CANNOT_BE_CANCELLED`): Returned if order is already in `Preparing`, `Ready for Pickup`, `Picked Up`, `Out for Delivery`, or `Delivered`.
  - `403 Forbidden` (`FORBIDDEN_ORDER_ACCESS`): User is not the customer who placed this order.
  - `404 Not Found` (`ORDER_NOT_FOUND`): Order ID does not exist.

---

### 8.8 Get Customer Profile
- **Path**: `GET /api/customers/profile`
- **Access**: Customer
- **Headers**:
  - `x-customer-id: cust_8829`
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "cust_8829",
      "name": "Tarshit Gupta",
      "email": "tarshit@example.com",
      "phone": "+91 98765 43210",
      "addresses": [
        {
          "id": "addr_01",
          "label": "Home",
          "street": "123 Tech Park Road",
          "city": "Bengaluru",
          "pincode": "560100",
          "isDefault": true
        }
      ]
    }
  }
  ```

---

### 8.9 Update Customer Profile
- **Path**: `PUT /api/customers/profile`
- **Access**: Customer
- **Headers**:
  - `x-customer-id: cust_8829`
- **Request Body**:
  ```json
  {
    "name": "Tarshit Gupta",
    "phone": "+91 98765 43210",
    "addresses": [
      {
        "id": "addr_01",
        "label": "Home",
        "street": "123 Tech Park Road",
        "city": "Bengaluru",
        "pincode": "560100",
        "isDefault": true
      }
    ]
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": { ...updated profile... },
    "message": "Profile updated successfully"
  }
  ```

---

## 9. CE-1 JSON Storage Engine & Repository Pattern

All persistence in Phase CE-1 is encapsulated within repositories targeting flat JSON collections in `backend/data/`:

| Collection | File Path | Primary Key | Description |
| :--- | :--- | :--- | :--- |
| **Customers** | `backend/data/customers.json` | `id` (`cust_...`) | Customer profiles and saved delivery addresses |
| **Restaurants** | `backend/data/restaurants.json` | `id` (`rest_...`) | Restaurant operational details and configurations |
| **Menus** | `backend/data/menus.json` | `itemId` (`menu_...`) | Menu items linked via `restaurantId` |
| **Orders** | `backend/data/orders.json` | `id` (`ord_...`) | Canonical orders and real-time lifecycle tracking |

### Standard Repository Interface
Every repository implements standard asynchronous methods:
- `findById(id)`: Returns single plain JavaScript object or `null`.
- `findAll(filterFn)`: Returns array of entities matching optional filter predicate.
- `create(entity)`: Persists and returns newly created object with timestamps.
- `update(id, partialEntity)`: Modifies matching record and updates `updatedAt`.
- `delete(id)`: Removes record by identifier.

This clean encapsulation guarantees that transitioning to MongoDB & Mongoose in CE-2 requires swapping only repository implementations without altering controllers or business services.

