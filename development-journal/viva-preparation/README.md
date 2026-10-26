# Zaykaa — Viva Preparation & Concept Index

Quick-revision resource for university viva examinations and project evaluations.

---

## 1. How Viva Notes Are Organized
Every `.txt` development entry across `shared/`, `m1-customer/`, and `m2-restaurant-delivery/` ends with a dedicated **VIVA QUESTIONS & ANSWERS** section with 3–5 concise, code-accurate questions and answers.

---

## 2. Viva Questions Index by Topic

| Topic | Entry Location | Key Concepts |
| :--- | :--- | :--- |
| **Server & Architecture Basics** | [`shared/01-project-initialization.txt`](file:///Users/tarshitgupta/Coding%20&%20Projects/Projects/Zaykaa/development-journal/shared/01-project-initialization.txt) | App vs. Server separation, ES Modules vs. CommonJS, Express middleware lifecycle, 4-tier layer pattern. |
| **Data Models & Contracts** | [`shared/02-shared-contracts.txt`](file:///Users/tarshitgupta/Coding%20&%20Projects/Projects/Zaykaa/development-journal/shared/02-shared-contracts.txt) | Integer paise currency, 9-status state machine, concurrency safe claims, localStorage cart. |
| **JSON Storage Engine** | [`shared/03-json-storage.txt`](file:///Users/tarshitgupta/Coding%20&%20Projects/Projects/Zaykaa/development-journal/shared/03-json-storage.txt) | Storage utility vs. repository, serialized read-modify-write, atomic write-rename, CE-2 migration. |
| **User Registration & Login** | [`shared/04-auth-registration-login.txt`](file:///Users/tarshitgupta/Coding%20&%20Projects/Projects/Zaykaa/development-journal/shared/04-auth-registration-login.txt) | Bcrypt vs SHA-256, salt rounds, JWT payload claims, account enumeration defense. |
| **Authentication & RBAC Middleware** | [`shared/05-auth-authorization.txt`](file:///Users/tarshitgupta/Coding%20&%20Projects/Projects/Zaykaa/development-journal/shared/05-auth-authorization.txt) | Active DB verification, 401 vs 403, registration race conditions, server-side authorization. |
| *Restaurant & Menu CRUD* | `m2-restaurant-delivery/01-restaurant-crud.txt` (Upcoming) | REST HTTP methods, status codes, JSON validation, item availability toggles. |
| *Customer Portal & Cart* | `m1-customer/01-customer-browse.txt` (Upcoming) | Fetch API, DOM manipulation, client-side filtering, cart state management. |
| *Delivery Partner Operations* | `m2-restaurant-delivery/02-delivery-partner-portal.txt` (Upcoming) | Order dispatch, delivery status transitions, route data handling. |
