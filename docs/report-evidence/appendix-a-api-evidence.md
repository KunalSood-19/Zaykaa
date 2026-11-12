# Appendix A: API Execution Evidence & Request Log

**Course / Evaluation:** Continuous Evaluation 1 (CE-1) Progress Review
**Project Title:** Zaykaa — Multi-Sided Food Delivery Platform
**Branch:** `feature/restaurant-delivery`
**Execution Environment:** Local Express Server (`http://localhost:3000`)
**Recorded Date & Time:** 2026-10-28T10:47:00+05:30
**Sensitive Data Policy:** All passwords, secrets, and JWT tokens are redacted with `[REDACTED_*]` markers.

---

## 1. Executive Summary of API Verification

The following 6 representative examples were captured from live HTTP requests against the active Express backend server. They demonstrate authentication, public catalog discovery, role-protected restaurant retrieval, valid state progression, invalid transition rejection, and role-based access control (RBAC) denial.

| # | Endpoint | Method | Authenticated Role | Status Code | Outcome | Category |
|---|---|:---:|---|:---:|---|---|
| **1** | `/api/auth/login` | `POST` | Public (None) | `200 OK` | ✅ Success | Authentication |
| **2** | `/api/restaurants/mine` | `GET` | `restaurant` | `200 OK` | ✅ Success | Restaurant Management |
| **3** | `/api/restaurants/rst_campus_zaika_01/menu` | `GET` | Public (None) | `200 OK` | ✅ Success | Menu Discovery |
| **4** | `/api/orders/ord_demo_03/status` | `PATCH` | `restaurant` | `200 OK` | ✅ Success | Valid State Machine |
| **5** | `/api/orders/ord_demo_01/status` | `PATCH` | `restaurant` | `400 Bad Request` | 🛡️ Rejected (Invalid State) | State Machine Defense |
| **6** | `/api/partners/dashboard` | `GET` | `restaurant` | `403 Forbidden` | 🛡️ Rejected (RBAC Guard) | Role-Based Access Control |

---

## 2. Representative API Request & Response Evidence

### Example 1: Authentication & JWT Login (Public)
- **HTTP Method:** `POST`
- **Implemented Endpoint:** `/api/auth/login`
- **Authenticated Role Used:** None (Public endpoint)
- **Request Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "email": "chef.sharma@zaykaa.com",
  "password": "[REDACTED_DEMO_PASSWORD]"
}
```
- **Actual HTTP Status Code:** `200 OK`
- **Actual Response Body:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "[REDACTED_JWT_TOKEN]",
    "user": {
      "id": "usr_rest_owner_01",
      "name": "Chef Rajinder Sharma",
      "email": "chef.sharma@zaykaa.com",
      "role": "restaurant",
      "phone": "+91 98450 12345"
    }
  }
}
```
- **Technical Explanation:** Validates credential verification, bcrypt password matching, and issuance of signed JSON Web Token containing claims (`userId`, `role: "restaurant"`).

---

### Example 2: Restaurant Profile Retrieval (Owner View)
- **HTTP Method:** `GET`
- **Implemented Endpoint:** `/api/restaurants/mine`
- **Authenticated Role Used:** `restaurant`
- **Request Headers:**
  - `Authorization: Bearer [REDACTED_JWT_TOKEN]`
- **Request Body:** None
- **Actual HTTP Status Code:** `200 OK`
- **Actual Response Body:**
```json
{
  "success": true,
  "data": {
    "id": "rst_campus_zaika_01",
    "ownerId": "usr_rest_owner_01",
    "name": "Campus Zaika Central",
    "description": "Popular student dhaba & quick-service kitchen serving homestyle North Indian curries, rolls, thalis, Chinese bowls, and fresh beverages near South Campus.",
    "cuisineTypes": [
      "North Indian",
      "Chinese",
      "Snacks",
      "Beverages",
      "South Indian"
    ],
    "address": {
      "street": "Shop 14, University Student Union Complex, South Campus Road",
      "city": "Bengaluru",
      "pincode": "560029"
    },
    "phone": "+91 98450 12345",
    "imageUrl": "/assets/images/restaurants/campus-zaika.jpg",
    "isOpen": true,
    "createdAt": "2026-10-24T19:58:51.862Z",
    "updatedAt": "2026-10-24T19:58:51.862Z"
  },
  "message": "Restaurant profile retrieved successfully"
}
```
- **Technical Explanation:** Demonstrates role-protected resolution of the authenticated user's linked restaurant entity including cuisine tags and operational status (`isOpen: true`).

---

### Example 3: Public Restaurant Menu Catalog Discovery
- **HTTP Method:** `GET`
- **Implemented Endpoint:** `/api/restaurants/rst_campus_zaika_01/menu`
- **Authenticated Role Used:** Public (Unauthenticated)
- **Request Headers:** None
- **Request Body:** None
- **Actual HTTP Status Code:** `200 OK`
- **Actual Response Body (Truncated Summary):**
```json
{
  "success": true,
  "data": {
    "restaurantId": "rst_campus_zaika_01",
    "items": [
      {
        "id": "item_demo_01",
        "restaurantId": "rst_campus_zaika_01",
        "name": "Butter Chicken with Naan",
        "description": "Tender chicken chunks simmered in aromatic makhani gravy served with crisp garlic butter naan.",
        "category": "North Indian",
        "price": 26000,
        "imageUrl": "/assets/images/menu/butter-chicken.jpg",
        "isAvailable": true
      },
      {
        "id": "item_demo_04",
        "restaurantId": "rst_campus_zaika_01",
        "name": "Amritsari Kulcha with Chole",
        "description": "Crispy layered potato-paneer stuffed kulcha served with tangy pindi chole and pickled onions.",
        "category": "North Indian",
        "price": 14000,
        "imageUrl": "/assets/images/menu/amritsari-kulcha.jpg",
        "isAvailable": false
      }
    ]
  },
  "message": "Menu items retrieved successfully"
}
```
- **Technical Explanation:** Validates public browsing of 15 menu items with strict integer paise representation (₹260.00 = `26000` paise) and active stock flags.

---

### Example 4: Valid Order Status Progression (Accepted → Preparing)
- **HTTP Method:** `PATCH`
- **Implemented Endpoint:** `/api/orders/ord_demo_03/status`
- **Authenticated Role Used:** `restaurant`
- **Request Headers:**
  - `Authorization: Bearer [REDACTED_JWT_TOKEN]`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "status": "Preparing"
}
```
- **Actual HTTP Status Code:** `200 OK`
- **Actual Response Body:**
```json
{
  "success": true,
  "data": {
    "id": "ord_demo_03",
    "customerId": "usr_cust_03",
    "customerName": "Rohan Verma",
    "customerPhone": "+91 98765 33003",
    "restaurantId": "rst_campus_zaika_01",
    "restaurantName": "Campus Zaika Central",
    "deliveryPartnerId": null,
    "status": "Preparing",
    "items": [
      {
        "itemId": "item_demo_06",
        "name": "Veg Hakka Noodles",
        "quantity": 1,
        "price": 15000
      },
      {
        "itemId": "item_demo_07",
        "name": "Chilli Paneer Dry",
        "quantity": 1,
        "price": 18000
      }
    ],
    "pricing": {
      "subtotal": 33000,
      "deliveryFee": 4000,
      "tax": 1650,
      "total": 38650
    },
    "deliveryAddress": {
      "street": "Faculty Housing Qtr 12, West Gate Avenue",
      "city": "Bengaluru",
      "pincode": "560029"
    },
    "timestamps": {
      "createdAt": "2026-10-27T19:40:51.862Z",
      "updatedAt": "2026-10-28T05:00:21.093Z"
    }
  },
  "message": "Order status updated successfully"
}
```
- **Technical Explanation:** Validates atomic order progression along the canonical lifecycle from `Accepted` to `Preparing`, updating ISO timestamps.

---

### Example 5: Illegal Order State Transition Rejection (Placed → Ready for Pickup)
- **HTTP Method:** `PATCH`
- **Implemented Endpoint:** `/api/orders/ord_demo_01/status`
- **Authenticated Role Used:** `restaurant`
- **Request Headers:**
  - `Authorization: Bearer [REDACTED_JWT_TOKEN]`
  - `Content-Type: application/json`
- **Request Body:**
```json
{
  "status": "Ready for Pickup"
}
```
- **Actual HTTP Status Code:** `400 Bad Request`
- **Actual Response Body:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATE_TRANSITION",
    "message": "Invalid status transition from 'Placed' to 'Ready for Pickup'"
  }
}
```
- **Technical Explanation:** Enforces state machine invariants: an order in `Placed` status cannot skip intermediate states (`Accepted`, `Preparing`) directly to `Ready for Pickup`.

---

### Example 6: Role-Based Access Control (RBAC) Denial
- **HTTP Method:** `GET`
- **Implemented Endpoint:** `/api/partners/dashboard`
- **Authenticated Role Used:** `restaurant` (Attempting unauthorized access to Delivery module)
- **Request Headers:**
  - `Authorization: Bearer [REDACTED_JWT_TOKEN]`
- **Request Body:** None
- **Actual HTTP Status Code:** `403 Forbidden`
- **Actual Response Body:**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied: requires one of the following roles: [delivery]"
  }
}
```
- **Technical Explanation:** Confirms that the `authorizeRoles('delivery')` middleware halts unauthorized requests before controller execution, returning HTTP 403.

---

## 3. Implementation Note on Delivery Routes Namespace

- **Mounted Prefix:** Delivery partner routes are mounted under prefix **`/api/partners`** in `backend/src/app.js` (line 40: `app.use('/api/partners', deliveryRouter)`).
- **Available Operations:**
  - `GET /api/partners/profile` (Courier fleet profile lookup)
  - `PATCH /api/partners/availability` (Duty status toggle)
  - `GET /api/partners/orders/available` (Dispatch pool)
  - `PATCH /api/partners/orders/:id/accept` (Atomic order claim)
  - `PATCH /api/partners/orders/:id/pickup` (Package pickup)
  - `PATCH /api/partners/orders/:id/out-for-delivery` (Transit start)
  - `PATCH /api/partners/orders/:id/deliver` (Handover & payout)
