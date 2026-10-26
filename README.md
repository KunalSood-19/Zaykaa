# zaykaa.

> **Cravings, Delivered.**  
> *A modern three-sided food delivery and live order tracking marketplace.*

---

## 1. Project Overview

**Zaykaa** is a full-stack, three-sided food delivery platform inspired by services such as Swiggy and Zomato. The platform orchestrates the complete food delivery lifecycle by connecting three distinct user groups within a single cohesive system:

- **Customer Portal:** Restaurant discovery, menu browsing, cart management, checkout, order placement, and live order tracking.
- **Restaurant Portal:** Restaurant profile management, real-time menu item CRUD operations, inventory availability toggling, and incoming order fulfillment.
- **Delivery Partner Portal:** Order dispatch acceptance, route details, pickup confirmations, transit status updates, and delivery completion.

---

## 2. Technology Stack

### Current Phase (CE-1)
- **Backend:** Node.js (v24+), Express.js (v5+), ES Modules (`"type": "module"`), File-based JSON persistence abstraction (Repository Pattern), dotenv
- **Frontend:** Semantic HTML5, Modern CSS3 (Vanilla), ES6+ JavaScript, Fetch API
- **Architecture:** Modular Monolithic architecture with 4-tier layer pattern (Routes -> Controllers -> Services -> Repositories)
- **Tooling:** npm, nodemon, Git

### Planned Future Phases
- **CE-2:** MongoDB, Mongoose ODM, React.js, React Router
- **Final Evaluation:** Socket.io real-time websockets, Leaflet/Mapbox live delivery tracking, geospatial discovery, payment gateway

---

## 3. Team Responsibilities

| Role | Developer | Key Domains & Deliverables |
| :--- | :--- | :--- |
| **Member 1 (M1)** | Customer & Ordering Lead | Customer portal UI, restaurant & menu browsing, customer cart & checkout, customer profile APIs, order creation endpoint (`POST /api/orders`), order history view. |
| **Member 2 (M2)** | Restaurant & Delivery Lead | Restaurant dashboard UI, menu management CRUD APIs, incoming order queue, order status transitions (`PATCH /api/orders/:id/status`), delivery partner dashboard & APIs. |
| **Shared** | M1 & M2 | Core Express architecture, authentication (JWT/RBAC), canonical order state machine, integration testing, API contracts, deployment. |

For detailed breakdown and collaboration protocols, refer to [`docs/team-responsibilities.md`](file:///Users/tarshitgupta/Coding%20&%20Projects/Projects/Zaykaa/docs/team-responsibilities.md).

---

## 4. Project Directory Structure

```text
zaykaa/
├── frontend/
│   ├── customer/            # Customer portal views & assets
│   ├── restaurant/          # Restaurant portal views & assets
│   ├── delivery/            # Delivery partner portal views & assets
│   ├── shared/              # Shared styles and client-side utilities
│   │   ├── css/
│   │   └── js/
│   ├── assets/              # Static media assets
│   │   ├── images/
│   │   └── icons/
│   └── index.html           # Setup placeholder / landing entrypoint
│
├── backend/
│   ├── src/
│   │   ├── modules/         # Feature domain modules (Routes, Controllers, Services, Repos)
│   │   │   ├── auth/
│   │   │   ├── customers/
│   │   │   ├── restaurants/
│   │   │   ├── menus/
│   │   │   ├── orders/      # Shared order core
│   │   │   └── delivery/
│   │   ├── middleware/      # Auth, error handling, validation middleware
│   │   ├── config/          # Environment and application constants
│   │   ├── utils/           # Helper functions and formatters
│   │   ├── app.js           # Express app, middleware, and route mounting
│   │   └── server.js        # Server listener and graceful shutdown
│   ├── data/                # Local JSON persistence storage (CE-1)
│   ├── package.json         # Backend dependencies and scripts
│   └── .env.example         # Environment configuration template
│
├── docs/
│   ├── architecture.md      # Architectural design & migration strategy
│   ├── api-contracts.md     # REST endpoint specs & canonical order schema
│   └── team-responsibilities.md # M1/M2 division & Git workflow
│
├── .gitignore
└── README.md
```

---

## 5. Getting Started

### Prerequisites
- **Node.js:** v20.0.0 or higher (v24+ recommended)
- **npm:** v10.0.0 or higher

### Installation

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create the local environment file:
   ```bash
   cp .env.example .env
   ```

### Running the Application

- **Production Mode:**
  ```bash
  npm start
  ```
  Runs `node src/server.js` on port `3000` (or the port defined in `.env`).

- **Development Mode (Hot Reloading):**
  ```bash
  npm run dev
  ```
  Runs `nodemon src/server.js` with automatic server reload on source code modifications.

### Verification Endpoints

Once the server is running:
- **Web App / Placeholder:** [http://localhost:3000/](http://localhost:3000/)
- **API Health Check:** [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 6. Current Implementation Status (Prompt 1.0)

- [x] Initialized modular monolithic project directory structure.
- [x] Configured backend with Node.js ES Modules (`"type": "module"`).
- [x] Implemented Express application with JSON parsing and static frontend serving.
- [x] Implemented verified health check endpoint (`GET /api/health`).
- [x] Configured API 404 handler and centralized error middleware.
- [x] Created setup verification placeholder landing page.
- [x] Authored comprehensive architecture, API contract, and team responsibility documentation.

---

## 7. Development Roadmap

- **Prompt 1.1:** Authentication & Authorization System (JWT, Role-based middleware for Customer, Restaurant, Delivery Partner).
- **Prompt 1.2:** Restaurant & Menu Management Module (M2).
- **Prompt 1.3:** Customer Portal & Restaurant Browsing (M1).
- **Prompt 1.4:** Shared Order Processing Lifecycle (M1 & M2).
- **Prompt 1.5:** Delivery Partner Workflow (M2).
- **CE-2 Milestone:** React.js frontend migration and MongoDB/Mongoose persistence integration.
- **Final Evaluation:** Real-time Socket.io updates, live map tracking, and deployment.
