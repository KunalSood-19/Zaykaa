# Zaykaa Team Responsibilities & Engineering Protocols

## 1. Team Allocation

The Zaykaa platform is divided between two full-stack developers to guarantee meaningful backend and frontend contributions for academic evaluation and professional demonstration.

---

### Member 1 (M1) — Customer & Ordering System

#### Frontend Ownership
- Customer web portal (`frontend/customer/`)
- Restaurant browsing & search interface
- Menu browsing & category filtration
- Cart management & checkout flow
- Customer-side order status & live updates view

#### Backend Ownership
- Customer profile & address APIs (`/api/customers`)
- Order creation endpoint & logic (`POST /api/orders`)
- Customer order history retrieval (`GET /api/customers/orders`)
- Future CE-2 React migration for customer portal
- Future CE-2 MongoDB migration for customer data

---

### Member 2 (M2) — Restaurant & Delivery System

#### Frontend Ownership
- Restaurant partner dashboard (`frontend/restaurant/`)
- Restaurant profile and operating hours interface
- Menu item management (CRUD, availability toggles, pricing)
- Incoming order notification and acceptance interface
- Delivery partner dashboard (`frontend/delivery/`)

#### Backend Ownership
- Restaurant & menu management APIs (`/api/restaurants`, `/api/restaurants/:id/menu`)
- Restaurant incoming orders retrieval (`GET /api/orders/restaurant/:id`)
- Order status transition APIs (`PATCH /api/orders/:id/status`)
- Delivery partner APIs (`/api/partners`)
- Future CE-2 React migration for restaurant & delivery portals
- Future CE-2 MongoDB migration for restaurant, menu, and delivery data

---

### Shared Responsibilities

- Initial project setup & Express architecture
- Authentication and authorization design (JWT, RBAC)
- Canonical order data contract schema
- Order lifecycle state machine validation rules
- API design consistency and error handling
- Integration testing across customer, restaurant, and delivery lifecycles
- Deployment and production environment configuration

---

## 2. Collaboration & Git Workflow

### A. Branch Strategy
- `main`: Production-ready branch. Never commit directly to `main`.
- `develop`: Integration branch where tested features meet before milestone releases.
- Feature branches: Created off `develop` using standard naming conventions:
  - `feature/m1-customer-browse`
  - `feature/m2-restaurant-menu-crud`
  - `fix/order-status-sync`

### B. Pull Request (PR) Workflow
1. **Branch Checkout:** Create feature branch from updated `develop`.
2. **Local Verification:** Run full test suite and verify `npm start` and `npm run dev` before pushing.
3. **Open PR:** Target `develop`. The description must include:
   - Summary of changes
   - Endpoints or views added/modified
   - Manual verification steps & curl/browser screenshots
4. **Peer Code Review:** The other team member must review and approve the PR before merging.
5. **Merge Strategy:** Squash and merge or rebase to keep history linear.

### C. Shared-File Editing Precautions
The following files and directories are shared:
- `backend/src/app.js` (Route mounting & global middleware)
- `backend/src/modules/orders/` (Shared order domain)
- `backend/src/modules/auth/` (Shared authentication)
- `frontend/shared/` (Shared styles and utility scripts)
- `docs/` (Architectural contracts)

**Precautions:**
1. **Pre-communication:** Notify the other developer before altering route registrations or shared contracts.
2. **Small PRs:** Keep PRs touching shared files focused and isolated.
3. **Contract First:** Any change to `docs/api-contracts.md` must be agreed upon before editing code.
