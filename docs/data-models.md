# Zaykaa Canonical Data Models & Entity Schemas

This document defines the canonical entity schemas, field specifications, data types, and relationships for the **Zaykaa** platform.

Both frontend and backend implementations across all feature branches must strictly adhere to these models.

---

## 1. Global Conventions & Standards

- **Identifiers:** Primary keys are strings formatted with domain prefixes:
  - Users: `usr_<uuid>`
  - Restaurants: `rst_<uuid>`
  - Menu Items: `item_<uuid>`
  - Orders: `ord_<uuid>`
  - Delivery Partners: `del_<uuid>`
- **Monetary Representation (INR):** To eliminate floating-point rounding errors, all internal prices, fees, taxes, and totals are stored as **integer paise** (1 INR = 100 paise).
  - *Example:* ₹280.00 is stored as `28000`.
  - Frontend display formatters convert paise to rupees (`₹ (paise / 100).toFixed(2)`).
- **Timestamps:** ISO 8601 UTC strings (e.g., `"2026-10-26T12:00:00.000Z"`).
- **Cardinality for CE-1:**
  - One user account has **exactly one role** (`customer`, `restaurant`, or `delivery`).
  - One restaurant owner manages **exactly one restaurant**.
  - One delivery partner profile corresponds to **exactly one user** with role `delivery`.
  - One order contains items from **exactly one restaurant**.

---

## 2. Canonical Entity Schemas

### A. User Entity (`users.json`)

Represents all registered platform actors.

```json
{
  "id": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "name": "Kunal Sood",
  "email": "kunal@example.com",
  "passwordHash": "$2a$10$abcdefghijklmnopqrstuvwxyz123456",
  "phone": "+91 98765 43210",
  "role": "customer",
  "createdAt": "2026-10-26T11:00:00.000Z",
  "updatedAt": "2026-10-26T11:00:00.000Z"
}
```

#### Field Specifications
| Field | Type | Required | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `id` | String | Yes | Unique identifier (`usr_<uuid>`) |
| `name` | String | Yes | Full name, 2–80 characters |
| `email` | String | Yes | Unique, lowercase, valid email format |
| `passwordHash` | String | Yes | Bcrypt hash. Never expose in API responses. |
| `phone` | String | Yes | 10–15 digits with optional country code |
| `role` | String | Yes | Enum: `"customer"`, `"restaurant"`, `"delivery"` |
| `createdAt` | String | Yes | ISO 8601 timestamp |
| `updatedAt` | String | Yes | ISO 8601 timestamp |

---

### B. Restaurant Entity (`restaurants.json`)

Represents a food service establishment managed by a user with role `restaurant`.

```json
{
  "id": "rst_4a7c1b23-8e9f-4321-a012-3456789abcde",
  "ownerId": "usr_7c8d9e0f-1a2b-3c4d-5e6f-7a8b9c0d1e2f",
  "name": "Spice Symphony",
  "description": "Authentic North Indian & Tandoori specialties",
  "cuisineTypes": ["North Indian", "Mughlai", "Biryani"],
  "address": {
    "street": "42 Outer Ring Road, Indiranagar",
    "city": "Bengaluru",
    "pincode": "560038"
  },
  "phone": "+91 80 4123 4567",
  "imageUrl": "/assets/images/restaurants/spice-symphony.jpg",
  "isOpen": true,
  "createdAt": "2026-10-26T11:15:00.000Z",
  "updatedAt": "2026-10-26T11:15:00.000Z"
}
```

#### Field Specifications
| Field | Type | Required | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `id` | String | Yes | Unique identifier (`rst_<uuid>`) |
| `ownerId` | String | Yes | References `users.id` where `role === "restaurant"` (1:1 in CE-1) |
| `name` | String | Yes | Restaurant name, 3–100 characters |
| `description` | String | No | Short description, max 300 characters |
| `cuisineTypes` | Array<String> | Yes | Non-empty array of cuisines |
| `address` | Object | Yes | Contains `street`, `city`, `pincode` (all required strings) |
| `phone` | String | Yes | Contact phone number |
| `imageUrl` | String | No | URL or local static asset path |
| `isOpen` | Boolean | Yes | Operational toggle controlled by restaurant owner (default: `true`) |
| `createdAt` | String | Yes | ISO 8601 timestamp |
| `updatedAt` | String | Yes | ISO 8601 timestamp |

---

### C. MenuItem Entity (`menus.json`)

Represents a dish offered by a specific restaurant.

```json
{
  "id": "item_f1e2d3c4-b5a6-4789-8012-3456789abcde",
  "restaurantId": "rst_4a7c1b23-8e9f-4321-a012-3456789abcde",
  "name": "Paneer Butter Masala",
  "description": "Cottage cheese cubes simmered in a rich tomato, butter, and cashew gravy.",
  "category": "Main Course",
  "price": 28000,
  "imageUrl": "/assets/images/menu/paneer-butter-masala.jpg",
  "isAvailable": true,
  "createdAt": "2026-10-26T11:20:00.000Z",
  "updatedAt": "2026-10-26T11:20:00.000Z"
}
```

#### Field Specifications
| Field | Type | Required | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `id` | String | Yes | Unique identifier (`item_<uuid>`) |
| `restaurantId` | String | Yes | References `restaurants.id` |
| `name` | String | Yes | Dish title, 2–80 characters |
| `description` | String | No | Dish description, max 250 characters |
| `category` | String | Yes | Category tag (e.g., `"Starters"`, `"Main Course"`, `"Breads"`, `"Desserts"`, `"Beverages"`) |
| `price` | Integer | Yes | **Integer paise** ($\ge 0$). Example: `28000` = ₹280.00 |
| `imageUrl` | String | No | URL or local static asset path |
| `isAvailable` | Boolean | Yes | Availability toggle by restaurant owner (default: `true`) |
| `createdAt` | String | Yes | ISO 8601 timestamp |
| `updatedAt` | String | Yes | ISO 8601 timestamp |

---

### D. DeliveryPartner Entity (`delivery_partners.json`)

Represents the operational delivery profile for a user with role `delivery`.

```json
{
  "id": "del_e8f7a6b5-c4d3-4210-9876-543210fedcba",
  "userId": "usr_1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
  "vehicleType": "Motorcycle",
  "isAvailable": true,
  "activeOrderId": null,
  "totalDeliveries": 18,
  "createdAt": "2026-10-26T11:25:00.000Z",
  "updatedAt": "2026-10-26T11:25:00.000Z"
}
```

#### Field Specifications
| Field | Type | Required | Constraints / Notes |
| :--- | :--- | :--- | :--- |
| `id` | String | Yes | Unique identifier (`del_<uuid>`) |
| `userId` | String | Yes | References `users.id` where `role === "delivery"` (1:1 in CE-1) |
| `vehicleType` | String | Yes | Enum: `"Motorcycle"`, `"Scooter"`, `"Bicycle"`, `"Electric Vehicle"` |
| `isAvailable` | Boolean | Yes | Online/offline availability toggle |
| `activeOrderId` | String / null| Yes | References `orders.id` currently being delivered; `null` if idle |
| `totalDeliveries`| Integer | Yes | Count of successfully delivered orders ($\ge 0$) |
| `createdAt` | String | Yes | ISO 8601 timestamp |
| `updatedAt` | String | Yes | ISO 8601 timestamp |

---

### E. Order Entity (`orders.json`)

Canonical multi-party entity connecting Customer, Restaurant, and Delivery Partner.

```json
{
  "id": "ord_10293847-5678-4321-abcd-ef0123456789",
  "customerId": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "customerName": "Kunal Sood",
  "customerPhone": "+91 98765 43210",
  "restaurantId": "rst_4a7c1b23-8e9f-4321-a012-3456789abcde",
  "restaurantName": "Spice Symphony",
  "deliveryPartnerId": null,
  "status": "Placed",
  "items": [
    {
      "itemId": "item_f1e2d3c4-b5a6-4789-8012-3456789abcde",
      "name": "Paneer Butter Masala",
      "quantity": 2,
      "price": 28000
    },
    {
      "itemId": "item_a9b8c7d6-e5f4-4321-8765-123456789abc",
      "name": "Butter Naan",
      "quantity": 3,
      "price": 6000
    }
  ],
  "pricing": {
    "subtotal": 74000,
    "deliveryFee": 4000,
    "tax": 3700,
    "total": 81700
  },
  "deliveryAddress": {
    "street": "123 Tech Park Road",
    "city": "Bengaluru",
    "pincode": "560100"
  },
  "timestamps": {
    "createdAt": "2026-10-26T11:30:00.000Z",
    "updatedAt": "2026-10-26T11:30:00.000Z"
  }
}
```

#### Order Integrity & Mutability Rules
1. **Initial Partner Assignment:** `deliveryPartnerId` is initialized to `null`. It is populated when a delivery partner accepts the order.
2. **Snapshotting:** `customerName`, `customerPhone`, `restaurantName`, and every item's `name` and `price` are snapshotted at placement time. Historical orders remain immutable even if the restaurant changes prices or menu names later.
3. **Monetary Consistency:** All pricing fields are integers in paise:
   - $\text{subtotal} = \sum (\text{item.price} \times \text{item.quantity})$
   - $\text{tax} = \text{round}(5\% \times \text{subtotal})$
   - $\text{deliveryFee} = 4000\text{ paise (₹40.00 flat for CE-1)}$
   - $\text{total} = \text{subtotal} + \text{deliveryFee} + \text{tax}$
4. **Single Restaurant Restriction:** An order can only contain items from a single restaurant (`items[*].restaurantId == order.restaurantId`). Cross-restaurant bundling is prohibited in CE-1.
5. **Field Immutability:**
   - **Immutable after creation:** `id`, `customerId`, `customerName`, `customerPhone`, `restaurantId`, `restaurantName`, `items`, `pricing`, `deliveryAddress`, `timestamps.createdAt`.
   - **Mutable during lifecycle:** `status`, `deliveryPartnerId`, `timestamps.updatedAt`.

---

### F. Cart Model (Client-Side for CE-1)

#### Architecture Decision: Client-Side Storage (`localStorage`)
- For CE-1, the shopping cart is maintained entirely on the **client side** using browser `localStorage`.
- **Rationale:**
  - Avoids high-frequency backend writes and sync issues for temporary selections.
  - Simplifies the architecture for our university project scope.
  - Aligns with modern SPAs and e-commerce platforms where server persistence is only required at checkout.
- **Server Authoritative Rule:** When checkout occurs via `POST /api/orders`, the client transmits `{ restaurantId, items: [{ itemId, quantity }], deliveryAddress }`. The server validates that all items belong to `restaurantId`, are currently `isAvailable: true`, and recomputes the canonical pricing from backend storage. Client-submitted prices are discarded.
