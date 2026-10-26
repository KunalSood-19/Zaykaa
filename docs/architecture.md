# Zaykaa Architecture Specification

## 1. Architectural Style: Modular Monolith

**Zaykaa** adopts a **modular monolithic architecture** designed for high cohesion, low coupling, and maintainability.

```
+--------------------------------------------------------------------------+
|                              Zaykaa Clients                              |
|   +-------------------+  +---------------------+  +-------------------+  |
|   |  Customer Portal  |  |  Restaurant Portal  |  |  Delivery Portal  |  |
|   +-------------------+  +---------------------+  +-------------------+  |
+--------------------------------------------------------------------------+
                                     |
                                     | HTTP / REST (Fetch API)
                                     v
+--------------------------------------------------------------------------+
|                     Zaykaa Express Application Server                    |
|                                                                          |
|  [Middleware Pipeline: Body Parsers, Auth, CORS, Logger, Error Handler]  |
|                                                                          |
|  +--------------------------------------------------------------------+  |
|  |                         Feature Modules                            |  |
|  |                                                                    |  |
|  |  +-----------+  +-----------+  +-------------+  +---------------+  |  |
|  |  |   Auth    |  | Customers |  | Restaurants |  |     Menus     |  |  |
|  |  +-----------+  +-----------+  +-------------+  +---------------+  |  |
|  |                                                                    |  |
|  |  +--------------------------+  +--------------------------------+  |  |
|  |  |    Orders (Shared Core)  |  |    Delivery Partner Services   |  |  |
|  |  +--------------------------+  +--------------------------------+  |  |
|  +--------------------------------------------------------------------+  |
|                                     |                                    |
|                             Repository Layer                             |
|                                     v                                    |
|                 +---------------------------------------+                |
|                 | CE-1: JSON Storage Engine (Data Dir)  |                |
|                 | CE-2: MongoDB & Mongoose Models       |                |
|                 +---------------------------------------+                |
+--------------------------------------------------------------------------+
```

### Key Architectural Principles
- **Single Process / Unified Server:** One Node.js/Express instance serves both static frontends and RESTful API endpoints.
- **Clear Domain Boundaries:** Code is organized by feature domains rather than technical types.
- **Separation of Concerns:** Presentation (frontend), HTTP routing, business logic, and persistence are strictly decoupled.

---

## 2. Frontend / Backend Separation

The repository is cleanly partitioned into two top-level directories:

```text
zaykaa/
├── frontend/    # Client application code (HTML, CSS, Vanilla JS, Assets)
└── backend/     # Server application code (Express, APIs, Storage)
```

- **Frontend:** Pure client-side code utilizing semantic HTML5, modern CSS3, and ES6+ JavaScript. No server-side templating (like EJS or Pug) is used. The frontend interacts with the backend exclusively via `fetch()` against REST endpoints.
- **Backend:** Node.js + Express exposing JSON endpoints under the `/api` route prefix, while serving static frontend assets from `frontend/` in production and local development.

---

## 3. Four-Tier Backend Module Design

Each feature module located in `backend/src/modules/<feature>/` strictly implements a 4-tier layer pattern:

```text
<feature>/
├── <feature>.routes.js       # Route definitions & middleware binding
├── <feature>.controller.js   # Request parsing, HTTP response formatting
├── <feature>.service.js      # Core business logic & domain rules
└── <feature>.repository.js   # Data persistence & retrieval abstraction
```

### Layer Responsibilities

| Layer | Responsibility | Allowed Dependencies | Prohibited Behaviors |
| :--- | :--- | :--- | :--- |
| **Routes** | Define URL paths, HTTP verbs, and bind validation/auth middleware. | Express Router, Controllers, Middleware | No business logic; no database queries |
| **Controllers** | Extract parameters (`req.params`, `req.query`, `req.body`), invoke Services, and return structured HTTP responses (`res.status().json()`). | Services, HTTP status utilities | No direct data storage access; no business rule calculation |
| **Services** | Implement domain rules, validations, calculations, and orchestrate repositories. | Repositories, Domain models, Utility helpers | No access to `req` or `res`; framework-agnostic |
| **Repositories** | Provide CRUD access to the underlying storage mechanism. | Data source (JSON file adapters, Mongoose models) | No business decisions; strictly reads and writes |

---

## 4. CE-1 to CE-2 Persistence Migration Strategy (Repository Pattern)

A core requirement for Zaykaa is enabling a zero-rewrite transition from **CE-1 (JSON file storage)** to **CE-2 (MongoDB & Mongoose)**.

```
Service Layer (Business Logic)
            |
            v
Repository Interface: findById(), findAll(), create(), update(), delete()
       /                          \
      v                            v
[CE-1: JSON File Repo]       [CE-2: Mongoose/MongoDB Repo]
(Reads/Writes backend/data)  (Queries MongoDB via Mongoose)
```

### Migration Decoupling Rules
1. **Services never touch `fs` directly:** The Node.js `fs` or `fs/promises` module is strictly encapsulated within the repository layer during CE-1.
2. **Canonical Contracts:** Repositories must accept and return plain JavaScript objects (POJOs) conforming to agreed domain schemas.
3. **Seamless Drop-In:** When migrating in CE-2, only the file inside `<feature>.repository.js` is swapped with Mongoose model calls. The service and controller remain intact.

---

## 5. Shared Order Domain Architecture

The Order lifecycle is the connective tissue of the three-sided marketplace:
- **Customer Portal:** Order creation, customer cancellation, status tracking.
- **Restaurant Portal:** Order acceptance, rejection, preparation updates.
- **Delivery Portal:** Delivery pickup, transit updates, delivery completion.

### Canonical Order State Transitions
```
[Placed]
   |
   +---> [Accepted] ---> [Preparing] ---> [Ready for Pickup]
   |                                              |
   |                                              v
   |                                        [Picked Up]
   |                                              |
   |                                              v
   |                                     [Out for Delivery]
   |                                              |
   |                                              v
   |                                         [Delivered]
   |
   +---> [Rejected / Cancelled]
```

To eliminate duplication and prevent status desynchronization:
- All order operations pass through a unified `orders` module (`backend/src/modules/orders/`).
- Status transition rules and authorization are validated centrally within `order.service.js`.

---

## 6. Future React & Real-Time Migration Considerations

1. **API Independence:** Because the frontend and backend communicate strictly via REST JSON contracts, replacing Vanilla JS with React components in CE-2 requires zero backend structural changes.
2. **Real-Time Extension (Final Evaluation):** The Express HTTP server instance created in `src/server.js` is already isolated from `src/app.js`, allowing Socket.io to attach seamlessly (`const io = new Server(server)`).
