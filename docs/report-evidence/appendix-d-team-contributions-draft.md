# Appendix D: Provisional Team Contributions & Division of Work (Draft)

**Course / Evaluation:** Continuous Evaluation 1 (CE-1) Progress Review
**Project Title:** Zaykaa — Multi-Sided Food Delivery Platform
**Document Status:** Provisional Draft (**Pending Formal Team Sign-off**)
**Source Documentation:** [docs/team-responsibilities.md](file:///Users/tarshitgupta/Coding%20&%20Projects/Projects/Zaykaa/docs/team-responsibilities.md), development journals, and repository logs.

---

## 1. Context & Team Division Guidelines

In accordance with project engineering protocols, work for Milestone 1 (M1) and Milestone 2 (M2) was structured along independent feature branches to ensure modular separation and avoid merge conflicts.

> [!WARNING]
> **Evaluation Disclaimer:**
> This breakdown represents a *provisional mapping* derived from documented repository responsibilities. Authorship cannot be inferred solely from commit authors or file paths. All assignments for M3 and M4 are explicitly flagged as **Pending team confirmation**.

---

## 2. Provisional Team Contribution Matrix

| Team Member Identifier | Assigned Module / Subsystem | Primary Engineering Responsibilities | Evidence from Repo & Documentation | Work Completed (Supported by Evidence) | Items Requiring Confirmation |
|---|---|---|---|---|---|
| **Member 1 (M1)** | **Customer Portal & Checkout** | - Customer discovery frontend<br>- Restaurant browsing & dish cards<br>- Cart state management (localStorage)<br>- Order creation & cancellation contracts<br>- Customer API definitions | - `docs/team-responsibilities.md` (Domain Ownership)<br>- `frontend/customer/*`<br>- `development-journal/m1-customer/*` | - Standalone Customer ordering UI<br>- Menu browsing & dish category filters<br>- Client-side cart persistence in localStorage | - Finalization of backend `POST /api/orders` checkout integration<br>- Formal attribution confirmation |
| **Member 2 (M2)** | **Restaurant & Delivery Modules** | - Restaurant Partner Dashboard UI<br>- Live Kitchen Order Queue & Status actions<br>- Menu Catalog CRUD & Stock availability<br>- Delivery Partner Fleet Console UI<br>- Order Claim Radar & Multi-step delivery lifecycle<br>- Gold Leaf unified design system | - `docs/team-responsibilities.md`<br>- `backend/src/modules/restaurants/*`<br>- `backend/src/modules/menus/*`<br>- `backend/src/modules/orders/*`<br>- `backend/src/modules/delivery/*`<br>- `frontend/restaurant/*`, `frontend/delivery/*`<br>- `tests/` (208 passing automated tests) | - Express REST APIs for Restaurant, Menu, Orders, Delivery<br>- Concurrency-safe JSON storage & mutex locks<br>- Full responsive Restaurant & Delivery dashboards<br>- Gold Leaf design system implementation & theme toggle<br>- 208 passing automated tests across 25 suites | - Final team review of CE-1 presentation slides |
| **Member 3 (M3)** | **Quality Assurance / Architecture** *(Tentative)* | - System documentation review<br>- Edge case & security validation<br>- Cross-module contract audits | - General documentation files in `docs/` | - Architectural contracts and review contributions as recorded in course submissions. | **Pending team confirmation:** Exact commits and implementation artifacts must be confirmed by the team. |
| **Member 4 (M4)** | **Frontend Integration & UX** *(Tentative)* | - User experience testing<br>- Cross-browser styling verification<br>- Integration workflow preparation | - General documentation and manual test notes | - Testing protocols and demonstration workflows for upcoming Milestone 3 integration. | **Pending team confirmation:** Exact module ownership and assigned presentation tasks must be confirmed by the team. |

---

## 3. Shared Engineering Artifacts

The following foundational components are designated as **Shared Engineering** between M1 and M2 in `docs/team-responsibilities.md`:
1. **Authentication Module (`backend/src/modules/auth/*`):** JWT token issuance, password hashing via bcrypt, and role-based route guards (`auth.middleware.js`).
2. **Canonical JSON Storage Engine (`backend/src/utils/jsonStore.js`):** File-based atomic persistence with serialized multi-collection mutex locking.
3. **Core Server Pipeline (`backend/src/app.js`):** Modular route mounting, JSON body parsing, static asset hosting, and centralized error handling.
4. **Order State Machine Contract (`docs/order-lifecycle.md`):** Canonical nine-state order transition specification agreed upon before feature branching.

---

## 4. Next Steps for Team Approval

1. **Team Sign-Off:** Each member must review this provisional draft and confirm their specific task deliverables prior to final CE-1 report submission.
2. **Integration Phase (Milestone 3):** All members will collaborate on convergence: integrating the M1 Customer checkout pipeline with M2 Restaurant kitchen queues and Delivery dispatch radars.
