# Zaykaa Team Responsibilities & Engineering Protocols

## 1. Domain Ownership Matrix

Both developers contribute meaningfully to both backend and frontend development across distinct domain boundaries.

```
+-----------------------------------------------------------------------------+
|                                    Zaykaa                                   |
|                                                                             |
|  +-------------------------------------+  +------------------------------+  |
|  |     Member 1 (M1)                   |  |     Member 2 (M2)            |  |
|  |     Branch: feature/customer        |  |     Branch: feature/         |  |
|  |                                     |  |             restaurant-      |  |
|  |  [Frontend]                         |  |             delivery         |  |
|  |  - Customer Portal UI               |  |                              |  |
|  |  - Restaurant Browsing & Filters    |  |  [Frontend]                  |  |
|  |  - Menu Browsing & Dish Cards       |  |  - Restaurant Dashboard UI   |  |
|  |  - Cart (localStorage) & Checkout   |  |  - Menu CRUD & Stock Toggle  |  |
|  |  - Order Tracking & History View    |  |  - Incoming Orders Queue     |  |
|  |                                     |  |  - Delivery Partner Portal   |  |
|  |  [Backend]                          |  |                              |  |
|  |  - Customer Profile APIs            |  |  [Backend]                   |  |
|  |  - Order Creation (POST /orders)    |  |  - Restaurant & Menu APIs    |  |
|  |  - Customer Cancel (POST /cancel)   |  |  - Prep Status (PATCH status)|  |
|  |  - Customer Orders Query            |  |  - Delivery Partner APIs     |  |
|  +-------------------------------------+  +------------------------------+  |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  |     Shared Engineering (M1 & M2)                                      |  |
|  |     - Shared Auth Module (JWT & Role Middleware)                      |  |
|  |     - Canonical Order Contract & State Machine Validation             |  |
|  |     - JSON Storage Utility (backend/src/utils/jsonStore.js)           |  |
|  |     - Express Pipeline & Error Handler (backend/src/app.js)           |  |
|  +-----------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------+
```

### Detailed Module Ownership Breakdown

| Module / Component | Responsible Member | Primary Files |
| :--- | :--- | :--- |
| **Auth Module** | **Shared** | `backend/src/modules/auth/*`, `backend/src/middleware/auth.middleware.js` |
| **Customer Module** | **Member 1 (M1)** | `backend/src/modules/customers/*`, `frontend/customer/*` |
| **Restaurant Module** | **Member 2 (M2)** | `backend/src/modules/restaurants/*`, `frontend/restaurant/*` |
| **Menu Module** | **Member 2 (M2)** | `backend/src/modules/menus/*`, `frontend/restaurant/menu.js` |
| **Order Module (Creation & Cancel)** | **Member 1 (M1)** | `order.controller.js` (create/cancel methods), `order.service.js` |
| **Order Module (Queue & Prep Status)**| **Member 2 (M2)** | `order.controller.js` (status/queue methods), `order.service.js` |
| **Delivery Module** | **Member 2 (M2)** | `backend/src/modules/delivery/*`, `frontend/delivery/*` |
| **Shared Storage Utility** | **Shared** | `backend/src/utils/jsonStore.js` |
| **Shared Middleware & App Setup** | **Shared** | `backend/src/middleware/*`, `backend/src/app.js` |

---

## 2. Preventing Merge Conflicts on Shared Files (`app.js`)

Because both members contribute to one Express server, direct parallel edits to `backend/src/app.js` could cause recurring merge conflicts. The following architectural protocols eliminate this friction:

### A. Modular Router Mount Protocol
1. **Self-Contained Module Routers:** Each feature module exports an Express Router containing all its internal endpoints (e.g., `auth.routes.js`, `customer.routes.js`, `restaurant.routes.js`).
2. **Single-Line Mounting in `app.js`:** Mounting in `app.js` is restricted to one isolated declaration per module:
   ```javascript
   app.use('/api/auth', authRouter);
   app.use('/api/customers', customerRouter);
   app.use('/api/restaurants', restaurantRouter);
   app.use('/api/orders', orderRouter);
   app.use('/api/partners', deliveryRouter);
   ```
3. **No Inline Route Logic in `app.js`:** All business logic, sub-routing, and module middleware must remain inside the module directory.

### B. Shared Order Module Co-Authoring Protocol
The `orders` module is split logically:
- `order.routes.js`: Defines all order endpoints.
- `order.controller.js`: Contains customer handlers (M1) and restaurant handlers (M2).
- `order.service.js`: Enforces canonical transitions defined in `docs/order-lifecycle.md`.

---

## 3. End-to-End Integration Workflow

To guarantee high code quality and smooth branch convergence:

```
[Prompt Contract Approval] (docs/data-models.md & docs/order-lifecycle.md)
           │
           ├───────────────────────────────┐
           ▼                               ▼
[M1: feature/customer]         [M2: feature/restaurant-delivery]
• Implement Customer Portal    • Implement Restaurant & Delivery
• Local verification & tests   • Local verification & tests
           │                               │
           ├───────────────────────────────┘
           ▼
[Pull Request to develop/main]
• Automated test run
• Peer code review & contract check
           │
           ▼
[Shared Integration Testing]
• End-to-end lifecycle verification: Placed -> Accepted -> Preparing -> Pickup -> Delivered
           │
           ▼
[Merge into main]
```

1. **Shared Contract Agreement:** Neither member writes implementation code until data schemas and API paths are approved in `docs/`.
2. **Independent Branch Development:** Developers work in their respective branches without modifying the other member's modules.
3. **Local Testing:** All endpoints are validated locally with documented curl tests before opening a PR.
4. **Peer Code Review:** The other member must inspect the pull request for contract compliance and schema alignment.
5. **Integration Testing:** Customer order placement $\to$ Restaurant status update $\to$ Delivery claim $\to$ Handover is tested end-to-end.
6. **Merge to `main`:** Squash or linear rebase into `main`.
