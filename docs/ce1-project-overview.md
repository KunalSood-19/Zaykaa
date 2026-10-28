# Zaykaa — CE-1 Project Overview & System Architecture

**Course / Evaluation:** Continuous Evaluation 1 (CE-1) Progress Review  
**Project Title:** Zaykaa — Multi-Sided Food Delivery Platform  
**Branch:** `feature/restaurant-delivery`  
**Current Milestone:** M2 Completed (Restaurant & Delivery Modules Implemented with Realistic Demo Data)  
**System Status:** Three Independent Subsystems (Customer, Restaurant, Delivery); Pre-Integration Phase  

---

## 1. Project Title & Description

**Zaykaa** (*"Cravings, Delivered"*) is a specialized three-sided food delivery platform engineered to connect:
1. **Hungry Customers** discovering local dishes, managing carts, and tracking orders.
2. **Restaurant Kitchen Partners** managing live operating hours, menu catalogs, and multi-stage food preparation pipelines.
3. **Delivery Couriers** claiming dispatched orders, coordinating pickups, and executing doorstep handovers.

Unlike monolithic or single-perspective applications, Zaykaa enforces strict domain boundaries, role-based access controls (RBAC), and canonical state machines to maintain transactional consistency across all three user roles.

---

## 2. Problem Statement

Existing campus and local-area food delivery solutions suffer from several architectural and operational flaws:
- **Lack of Atomic State Progression:** Orders frequently desynchronize between restaurant kitchen boards and courier applications, resulting in cold food pickups or contradictory statuses.
- **Uncontrolled Concurrency in Courier Claiming:** Race conditions allow multiple delivery drivers to accept the same order simultaneously, causing wasted trips and driver disputes.
- **Fragile Data Precision:** Storing floating-point currency values causes recurring rounding inaccuracies across subtotal calculations, tax computations, and delivery payouts.
- **Complex, Heavy Framework Overhead:** Modern web frameworks often introduce bloated dependency trees, complex build pipelines, and hydration mismatches for standard dashboard operations.

---

## 3. Objectives & Proposed Solution

### Objectives
1. Implement a clean, modular Express backend with strict REST API contracts and JWT authentication.
2. Build responsive, framework-free vanilla JavaScript SPAs following the approved **Gold Leaf** design identity.
3. Enforce an immutable 9-stage order state machine with role-guarded transitions.
4. Prevent race conditions through atomic storage operations with per-collection mutex serialization.
5. Standardize all internal financial computations using integer paise representation (1 INR = 100 paise).

### Proposed Solution
Zaykaa addresses these challenges through a service-repository pattern, modular Express routing, an asynchronous JSON-file storage engine with read/write mutex locks, and lightweight vanilla ES modules. The system isolates Customer, Restaurant, and Delivery concerns into dedicated modules with clearly defined API contracts.

---

## 4. Current Technology Stack

| Layer | Technologies Used | Rationale / Benefits |
|---|---|---|
| **Backend Runtime** | Node.js (v20+ ES Modules) | Fast async I/O, native ESM support, cross-platform stability |
| **API Framework** | Express.js (v5.x) | Minimalist, unopinionated REST routing, centralized error pipeline |
| **Authentication** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs` | Stateless session management, password hashing (10 salt rounds), RBAC |
| **Persistence Engine** | Atomic Async JSON Store (`backend/src/utils/jsonStore.js`) | Zero external database dependency for university demo, acid-safe file replacement via temp files and in-memory mutex queues |
| **Frontend Core** | Semantic HTML5, Vanilla JavaScript (ES6+ Modules) | Zero bundler/transpiler overhead, native browser performance, instant execution |
| **Styling & Design System** | Vanilla CSS with Custom Properties (Gold Leaf Design Tokens) | Shared tokens across modules (`variables.css`), dark/light theme switching, responsive flexbox/grid layouts |
| **Automated Testing** | Node.js Native Test Runner (`node:test`, `node:assert/strict`) | Built-in zero-dependency testing, fast parallel test execution (208 tests) |

---

## 5. Existing Project Architecture & Folder Structure

```
Zaykaa/
├── backend/
│   ├── data/                          # Canonical JSON database collections
│   │   ├── users.json                 # User accounts & role assignments
│   │   ├── restaurants.json           # Restaurant profiles & operating hours
│   │   ├── menus.json                 # Restaurant dishes & stock availability
│   │   ├── orders.json                # Canonical multi-party orders & lifecycle states
│   │   └── delivery_partners.json     # Courier profiles & duty statuses
│   ├── scripts/
│   │   └── seed-demo-data.js          # Repeatable CE-1 mock data generator
│   ├── src/
│   │   ├── config/                    # JWT & environment configurations
│   │   ├── middleware/                # JWT auth & role authorization guards
│   │   ├── modules/
│   │   │   ├── auth/                  # Register, login, /me routes & services
│   │   │   ├── restaurants/           # Restaurant profile CRUD & ownership
│   │   │   ├── menus/                 # Menu item CRUD & availability toggle
│   │   │   ├── orders/                # Restaurant queue & kitchen status transitions
│   │   │   └── delivery/              # Partner profile, claim, & delivery workflow
│   │   ├── utils/
│   │   │   └── jsonStore.js           # Mutex-serialized atomic JSON storage utility
│   │   ├── app.js                     # Express application setup & route mounting
│   │   └── server.js                  # HTTP server listener (port 3000)
│   └── tests/                         # Automated unit & integration test suites (208 tests)
├── frontend/
│   ├── assets/                        # Shared images, icons, and branding
│   ├── customer/                      # Customer Portal (Member 1 domain)
│   │   └── .gitkeep
│   ├── restaurant/                    # Restaurant Partner Dashboard (Member 2 domain)
│   │   ├── index.html                 # Single-page dashboard container
│   │   ├── restaurant.css             # Gold Leaf kitchen styling
│   │   └── js/                        # ES modules: app.js, overview.js, orders.js, menu.js, profile.js
│   ├── delivery/                      # Delivery Partner Dashboard (Member 2 domain)
│   │   ├── index.html                 # Single-page courier console
│   │   ├── delivery.css               # Gold Leaf courier styling
│   │   └── js/                        # ES modules: app.js, overview.js, available.js, active.js, history.js, profile.js
│   ├── shared/
│   │   ├── css/                       # variables.css (Gold Leaf tokens), base.css
│   │   └── js/                        # api.js, auth.js, theme.js, utils.js
│   └── index.html                     # Platform root entry point
├── development-journal/               # Sequential engineering logs (Entries 01-10)
└── docs/                              # Architecture, lifecycle, & CE-1 documentation
```

---

## 6. Module-Wise Division of Work

The engineering responsibilities are divided cleanly across two team members:

```
+-----------------------------------------------------------------------------+
|                                    Zaykaa                                   |
|                                                                             |
|  +-------------------------------------+  +------------------------------+  |
|  |     Member 1 (M1)                   |  |     Member 2 (M2)            |  |
|  |     Branch: feature/customer        |  |     Branch: feature/         |  |
|  |                                     |  |             restaurant-      |  |
|  |  [Frontend]                         |  |             delivery         |  |
|  |  - Customer Portal UI               |  |  [Frontend]                  |  |
|  |  - Restaurant Browsing & Filters    |  |  - Restaurant Dashboard UI   |  |
|  |  - Menu Browsing & Dish Cards       |  |  - Menu Management & Toggle  |  |
|  |  - Cart (localStorage) & Checkout   |  |  - Incoming Orders Queue     |  |
|  |  - Order Tracking & History View    |  |  - Delivery Partner Portal   |  |
|  |                                     |  |  - Gold Leaf Design System   |  |
|  |  [Backend]                          |  |                              |  |
|  |  - Customer Profile APIs            |  |  [Backend]                   |  |
|  |  - Order Creation (POST /orders)    |  |  - Restaurant & Menu APIs    |  |
|  |  - Customer Cancel (PATCH /cancel)  |  |  - Kitchen Status Pipeline   |  |
|  |  - Customer Orders Query            |  |  - Courier Profile & Workflow|  |
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

---

## 7. Team Responsibilities Based on Project Documentation

| Responsibility Area | Member 1 (M1) | Member 2 (M2) | Shared |
|---|:---:|:---:|:---:|
| User Registration & Login Backend | | | **Yes** |
| JWT Authentication & Role Middleware | | | **Yes** |
| JSON Storage Foundation (`jsonStore.js`) | | | **Yes** |
| Customer Discovery & Browsing Frontend | **Yes** | | |
| Client-Side Cart & Checkout (`POST /orders`) | **Yes** | | |
| Restaurant Profile & Operating Status APIs | | **Yes** | |
| Restaurant Menu Item CRUD APIs & UI | | **Yes** | |
| Incoming Order Queue & Kitchen Status APIs | | **Yes** | |
| Delivery Partner Profile & Duty Status APIs | | **Yes** | |
| Delivery Claiming & Order Handover Lifecycle | | **Yes** | |
| Delivery Partner Fleet Console UI | | **Yes** | |
| Gold Leaf Design System & Theme Manager | | **Yes** | |
| CE-1 Mock Data Setup & Demonstration Suite | | **Yes** | |

---

## 8. Completed Features (By Status)

### A. Fully Implemented & Verified Functionality
- **Authentication & RBAC:**
  - `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.
  - Passwords hashed using bcrypt (10 rounds).
  - JWT tokens signed with expiration and verified by `authenticateToken`.
  - Role-based route authorization via `authorizeRoles('restaurant')` and `authorizeRoles('delivery')`.
- **Restaurant Management:**
  - `POST /api/restaurants`, `GET /api/restaurants/mine`, `GET /api/restaurants/:id`, `PUT /api/restaurants/:id`, `DELETE /api/restaurants/:id`.
  - Strict 1:1 restaurant-to-owner cardinality enforcement.
  - Kitchen open/closed status toggle (`isOpen`).
- **Menu Management:**
  - `POST /api/restaurants/:id/menu`, `GET /api/restaurants/:id/menu`, `PUT /api/restaurants/:id/menu/:itemId`, `PATCH /api/restaurants/:id/menu/:itemId/availability`, `DELETE /api/restaurants/:id/menu/:itemId`.
  - Strict cross-restaurant isolation.
  - Integer paise price validation (negative, decimal, non-numeric rejected).
- **Restaurant Order Management:**
  - `GET /api/orders/restaurant/:restaurantId`, `PATCH /api/orders/:id/status`.
  - Sequential kitchen lifecycle transitions: `Placed` → `Accepted` or `Rejected`; `Accepted` → `Preparing`; `Preparing` → `Ready for Pickup`.
  - Terminal state immutability enforcement.
- **Delivery Partner Management:**
  - `POST /api/partners`, `GET /api/partners/me`, `PATCH /api/partners/availability`, `PUT /api/partners/me`.
  - Vehicle classification support (`Motorcycle`, `Scooter`, `Bicycle`, `Electric Vehicle`).
  - Available order discovery (`GET /api/partners/orders/available`).
  - Atomic delivery claim (`PATCH /api/partners/orders/:id/accept`) enforcing the **one-active-order-per-courier** invariant.
  - Courier delivery transitions: `Ready for Pickup` → `Picked Up` → `Out for Delivery` → `Delivered`.
  - Delivery history aggregation and earnings calculations.
- **Gold Leaf Frontend Dashboards:**
  - Restaurant Partner Dashboard (`frontend/restaurant/index.html`) with Overview metrics, Order Queue, Menu Catalog CRUD, and Profile views.
  - Delivery Partner Fleet Console (`frontend/delivery/index.html`) with Overview, Available Orders, Active Stepper, History, and Profile views.
  - Shared theme manager (`frontend/shared/js/theme.js`) providing instant light/dark/system switching and `localStorage` persistence without reload.
- **Automated Testing:**
  - 208 passing tests across 25 suites verifying backend APIs, storage mutex concurrency, price conversions, and frontend design tokens.

### B. Demo-Only Functionality (CE-1 Preparation)
- **Pre-Seeded Mock Data:**
  - 9 realistic user accounts with hashed credentials (`Password123!`).
  - 1 campus restaurant profile (*Campus Zaika Central*).
  - 15 realistic dishes across 5 categories in integer paise.
  - 2 courier profiles (1 active on motorcycle, 1 idle on EV).
  - 16 realistic orders covering all 9 canonical order statuses.

### C. Planned Functionality (Post CE-1 / Future Integration)
- Real-time customer checkout integration (`POST /api/orders` from M1 Customer cart).
- End-to-end multi-window order tracking (Customer watches live status changes executed by Restaurant and Delivery).
- Customer order cancellation before preparation (`PATCH /api/orders/:id/cancel`).
- WebSockets / Server-Sent Events (SSE) for live push updates (replacing polling).
- Live geolocation mapping for courier transit routes.

---

## 9. Features Currently Under Development

- **Customer Module (M1):** Customer browsing interface, local storage cart, and checkout submission endpoints on branch `feature/customer`.
- **Inter-Module Convergence:** Preparing clean pull request interfaces to merge `feature/customer` and `feature/restaurant-delivery` after CE-1 evaluations.

---

## 10. Role of Core Architectural Building Blocks

### A. JSON Storage (`backend/src/utils/jsonStore.js`)
- Acts as an in-process, zero-dependency document store storing collections in `backend/data/*.json`.
- Uses an asynchronous read/write queue with per-collection mutex locks (`async-mutex` pattern) to serialize writes and eliminate race conditions.
- Uses atomic file replacement (writes to `.tmp` file and renames via `fs.rename`) to guarantee durability against sudden process crashes.

### B. REST APIs & Envelopes
- All API endpoints adhere to strict JSON response envelopes:
  - Success: `{ "success": true, "data": { ... }, "message": "..." }`
  - Failure: `{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }`
- Prevents ambiguity in client-side error handling and toast notifications.

### C. JWT Authentication & RBAC
- Stateless authorization header format: `Bearer <token>`.
- Payloads embed `{ userId, role }`.
- Route guards prevent customers from modifying menus, delivery drivers from editing restaurant profiles, and restaurant owners from claiming orders.

### D. Frontend Dashboards
- Pure vanilla single-page applications utilizing standard ES modules.
- Fast render cycles without virtual DOM overhead.
- Shared Gold Leaf CSS tokens (`#FAF7F0` light ivory, `#101311` obsidian dark, `#B8862B`/`#E4B75E` gold, `#60764B`/`#94A67C` olive).

---

## 11. Current Progress & Completed Milestones

```
+--------------------------------------------------------------------------+
| MILESTONE TIMELINE                                                       |
+--------------------------------------------------------------------------+
| [M1] Architecture Setup & Foundation                      | [COMPLETED]  |
|      - Project structure, JSON store, base Express pipeline               |
|                                                                          |
| [M2-Backend] Restaurant & Delivery Backend Services       | [COMPLETED]  |
|      - Restaurant CRUD & Ownership (Prompt 2.0)                          |
|      - Menu Item CRUD & Stock Toggle (Prompt 2.1)                         |
|      - Delivery Partner Profiles & Duty Status (Prompt 2.2)               |
|      - Restaurant Order Queue & Lifecycle (Prompt 2.3)                    |
|      - Delivery Assignment & State Machine (Prompt 2.4)                   |
|                                                                          |
| [M2-Frontend] Dashboards & Visual Identity                | [COMPLETED]  |
|      - Restaurant Dashboard Vanilla UI (Prompt 2.5)                       |
|      - Delivery Partner Dashboard Vanilla UI (Prompt 2.6)                 |
|      - Gold Leaf UI Redesign & Shared Tokens (Prompt 2.6A)                |
|      - Restaurant Gold Leaf Redesign & Integration (Prompt 2.7)           |
|      - Theme Toggle Reliability & Idempotent Binding (Prompt 2.7A)        |
|                                                                          |
| [CE-1 Demo Prep] Realistic Mock Data & Review Materials   | [COMPLETED]  |
|      - Repeatable Seeder Script (npm run seed)                            |
|      - Comprehensive Inventory & Demo Manual (Prompt 2.8)                 |
+--------------------------------------------------------------------------+
```

---

## 12. Testing Progress & Verification Summary

Zaykaa utilizes the native Node.js test runner (`node --test tests/*.test.js`). All tests pass with zero external testing dependencies:

| Test Suite File | Domain / Prompts Covered | Test Count | Pass Rate |
|---|---|:---:|:---:|
| `frontend.restaurant.test.js` | Price formatters, XSS escape, status badges, action resolvers, Gold Leaf tokens, theme idempotency | 10 | 100% |
| `frontend.delivery.test.js` | Action resolvers, fee aggregations, address sanitizer, courier lifecycle, theme tests | 10 | 100% |
| `restaurant.crud.test.js` | Restaurant profile creation, validation, ownership, listing, deletion | 27 | 100% |
| `menu.crud.test.js` | Menu item creation, update, stock toggle, isolation, integer paise validation | 30 | 100% |
| `restaurant.order.test.js` | Order queue isolation, lifecycle state progression (`Placed` → `Ready`) | 20 | 100% |
| `delivery.partner.test.js` | Courier profile registration, duty toggle, vehicle selection | 26 | 100% |
| `delivery.order.test.js` | Available order query, atomic order claim, lifecycle handover (`Pickup` → `Deliver`) | 25 | 100% |
| Extra & Foundation Suites | JsonStore concurrency, edge cases, auth guards, lifecycle extra tests | 60 | 100% |
| **Total** | **Full Backend & Frontend Foundation Coverage** | **208 tests** | **100%** |

---

## 13. Challenges Encountered & Solutions Implemented

1. **Floating-Point Rounding in Order Calculations:**
   - *Problem:* JavaScript standard floats produce rounding artifacts like `0.1 + 0.2 = 0.30000000000000004` during item summation and tax calculations.
   - *Solution:* Standardized all storage and internal arithmetic on **integer paise**. Formatters convert to rupees exclusively at the presentation layer.
2. **Race Conditions in Delivery Partner Assignment:**
   - *Problem:* Two couriers simultaneously claiming the same order could both succeed, violating the rule that an order can only have one assigned driver.
   - *Solution:* Wrapped order assignment in an atomic Mutex lock checking `order.status === 'Ready for Pickup'` and `order.deliveryPartnerId === null`, while verifying `partner.activeOrderId === null` before updating both records in a single serialized write.
3. **Modal Backdrop Pointer Interception:**
   - *Problem:* Unauthenticated login modals covered the viewport with a fixed backdrop (`z-index: 1000`), blocking pointer clicks to the sticky header theme toggle (`z-index: 90`).
   - *Solution:* Elevated top headers to `z-index: 1001` and added direct in-modal theme buttons, allowing users to switch themes from anywhere.
4. **Theme Event Double-Binding:**
   - *Problem:* Importing theme scripts in multiple modules caused double event listeners to attach, instantly canceling out theme toggles.
   - *Solution:* Implemented an idempotent binding function with a `data-theme-bound` DOM guard ensuring each toggle is bound exactly once.

---

## 14. Planned Future Integration & Enhancements

Following the CE-1 progress evaluation:
1. **Convergence of Feature Branches:** Merge `feature/customer` and `feature/restaurant-delivery` into `develop`.
2. **Customer Checkout Flow:** Customer orders placed via `POST /api/orders` will directly populate the Restaurant's incoming queue in real time.
3. **Multi-Window Live Demonstration:** Demonstrate an order being placed in Window 1 (Customer), accepted and prepared in Window 2 (Restaurant), and claimed and delivered in Window 3 (Delivery).
4. **Push Notification Layer:** Upgrade polling loops to lightweight Server-Sent Events (SSE).

---

## 15. CE-1 Presentation Talking Points (For Faculty)

When presenting to faculty, emphasize these five key architectural points:

1. **Clear Division of Domain Responsibilities:**  
   *"We intentionally decoupled Customer (M1) from Restaurant and Delivery (M2) to allow parallel feature velocity without merge conflicts. Contracts were pre-agreed in `docs/data-models.md` and `docs/order-lifecycle.md`."*
2. **Financial Precision via Integer Paise:**  
   *"To eliminate floating-point precision loss common in e-commerce apps, all monetary amounts—subtotals, taxes, and courier fees—are strictly stored as integer paise."*
3. **Strict Order State Machine:**  
   *"Our backend order lifecycle enforces a 9-stage sequential state machine. Skipping states or transitioning terminal orders is strictly rejected by the server with clear HTTP 400 errors."*
4. **Concurrency Safety in a Lightweight Architecture:**  
   *"Without requiring heavy enterprise database servers for our demo, we engineered atomic write serialization and temp-file replacement in `jsonStore.js`, ensuring zero lost updates during concurrent operations."*
5. **Modern, Framework-Free Frontend Performance:**  
   *"Both dashboards are built with vanilla JavaScript ES modules and custom CSS properties following our bespoke Gold Leaf design system, achieving sub-millisecond theme switching and zero build-step overhead."*
