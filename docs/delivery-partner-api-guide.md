# Zaykaa — Delivery Partner Profile & Availability API Guide

Comprehensive technical reference, contract specification, and local testing instructions for the Delivery Partner module (`/api/partners`).

---

## 1. Architectural Overview & Responsibilities

The **Delivery Partner Module** manages the lifecycle, operational settings, vehicle classification, and online/offline status of delivery personnel on the Zaykaa platform.

- **URL Prefix:** `/api/partners`
- **Controller/Service:** `backend/src/modules/delivery/`
- **Storage Collection:** `backend/data/delivery_partners.json`
- **ID Convention:** `del_<uuid>`
- **Access Rule:** Requires authenticated platform user with `role === "delivery"`.

---

## 2. Canonical Data Model

| Field | Type | Required | Constraints / Rules |
| :--- | :--- | :--- | :--- |
| `id` | String | Yes | Unique identifier prefixed with `del_` (`del_<uuid>`). Client cannot set or modify. |
| `userId` | String | Yes | References `users.id` where `role === "delivery"`. 1:1 user-to-partner mapping. |
| `vehicleType` | String | Yes | Enum: `"Motorcycle"`, `"Scooter"`, `"Bicycle"`, `"Electric Vehicle"`. |
| `isAvailable` | Boolean | Yes | Operational toggle. Default upon creation: `false`. Cannot be `true` during active orders. |
| `activeOrderId` | String/null | Yes | References `orders.id` currently being delivered; `null` if idle. |
| `totalDeliveries`| Integer | Yes | Count of successfully delivered orders ($\ge 0$). Starts at `0`. |
| `createdAt` | String | Yes | ISO 8601 UTC timestamp. |
| `updatedAt` | String | Yes | ISO 8601 UTC timestamp. |

---

## 3. Endpoints Specification

### A. Create Delivery Partner Profile

Registers an operational delivery partner record for the authenticated user.

- **Method & Path:** `POST /api/partners` (Alias: `POST /api/partners/profile`)
- **Access:** Role: `delivery`
- **Headers:** `Authorization: Bearer <jwt_token>`

**Request Body:**
```json
{
  "vehicleType": "Motorcycle",
  "isAvailable": false
}
```

**Success Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "id": "del_e8f7a6b5-c4d3-4210-9876-543210fedcba",
    "userId": "usr_1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "vehicleType": "Motorcycle",
    "isAvailable": false,
    "activeOrderId": null,
    "totalDeliveries": 0,
    "createdAt": "2026-10-27T04:53:14.183Z",
    "updatedAt": "2026-10-27T04:53:14.183Z"
  },
  "message": "Delivery partner profile created successfully"
}
```

---

### B. Get Current Partner Profile

Retrieves the profile of the currently logged-in delivery partner.

- **Method & Path:** `GET /api/partners/me` (Alias: `GET /api/partners/profile`)
- **Access:** Role: `delivery`
- **Headers:** `Authorization: Bearer <jwt_token>`

**Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "id": "del_e8f7a6b5-c4d3-4210-9876-543210fedcba",
    "userId": "usr_1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "vehicleType": "Motorcycle",
    "isAvailable": true,
    "activeOrderId": null,
    "totalDeliveries": 12,
    "createdAt": "2026-10-27T04:53:14.183Z",
    "updatedAt": "2026-10-27T05:10:00.000Z"
  },
  "message": "Delivery partner profile retrieved successfully"
}
```

---

### C. Get Partner Dashboard Overview

Retrieves operational metrics, partner details, active assignment, and the available order pool.

- **Method & Path:** `GET /api/partners/dashboard`
- **Access:** Role: `delivery`
- **Headers:** `Authorization: Bearer <jwt_token>`

**Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "partner": {
      "id": "del_e8f7a6b5-c4d3-4210-9876-543210fedcba",
      "userId": "usr_1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "vehicleType": "Scooter",
      "isAvailable": true,
      "activeOrderId": null,
      "totalDeliveries": 15
    },
    "activeOrder": null,
    "availableOrders": []
  },
  "message": "Dashboard retrieved successfully"
}
```

---

### D. Update Profile

Allows modifying permitted profile properties (vehicle type and/or availability).

- **Method & Path:** `PUT /api/partners/profile` (Alias: `PUT /api/partners/me` or `PUT /api/partners/:id`)
- **Access:** Role: `delivery` (owner)
- **Headers:** `Authorization: Bearer <jwt_token>`

**Request Body:**
```json
{
  "vehicleType": "Electric Vehicle"
}
```

**Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "id": "del_e8f7a6b5-c4d3-4210-9876-543210fedcba",
    "userId": "usr_1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "vehicleType": "Electric Vehicle",
    "isAvailable": true,
    "activeOrderId": null,
    "totalDeliveries": 15,
    "createdAt": "2026-10-27T04:53:14.183Z",
    "updatedAt": "2026-10-27T05:25:00.000Z"
  },
  "message": "Delivery partner profile updated successfully"
}
```

---

### E. Toggle Availability Status

Dedicated atomic toggle to switch duty status between online (`true`) and offline (`false`).

- **Method & Path:** `PATCH /api/partners/availability`
- **Access:** Role: `delivery`
- **Headers:** `Authorization: Bearer <jwt_token>`

**Request Body:**
```json
{
  "isAvailable": true
}
```

**Success Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "id": "del_e8f7a6b5-c4d3-4210-9876-543210fedcba",
    "userId": "usr_1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "vehicleType": "Electric Vehicle",
    "isAvailable": true,
    "activeOrderId": null,
    "totalDeliveries": 15,
    "createdAt": "2026-10-27T04:53:14.183Z",
    "updatedAt": "2026-10-27T05:30:00.000Z"
  },
  "message": "Availability status updated successfully"
}
```

---

## 4. Availability & Concurrency Rules

1. **Default Offline State:** Newly registered delivery partners always start with `isAvailable = false` to prevent accidental dispatch before the partner is actively ready for duty.
2. **Active Order Guard:** If `partner.activeOrderId !== null`, attempting to set `isAvailable = true` returns `400 Bad Request` with error code `ACTIVE_ORDER_RESTRICTION`.
3. **Offline While Busy:** A partner with an active order can set `isAvailable = false` to indicate they will not take any further orders after their current delivery.
4. **1:1 Enforced via Mutex:** A single user account with `role === "delivery"` can possess at most one delivery partner profile. Parallel creation attempts are queued through `JsonStore._serialize`, returning `409 Conflict` for duplicate attempts without data corruption.

---

## 5. Standard Error Envelopes

Every error response adheres strictly to the canonical Zaykaa error envelope:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Detailed failure explanation",
    "details": []
  }
}
```

### Error Code Summary:
| Error Code | HTTP Status | Trigger Condition |
| :--- | :--- | :--- |
| `VALIDATION_ERROR` | `400 Bad Request` | Missing/invalid vehicle type, non-boolean availability, unknown fields, protected field tampering. |
| `ACTIVE_ORDER_RESTRICTION` | `400 Bad Request` | Attempting to toggle availability to `true` while an order is active. |
| `UNAUTHORIZED` | `401 Unauthorized` | Missing, malformed, or expired Bearer JWT token. |
| `FORBIDDEN` | `403 Forbidden` | Non-delivery user (customer/restaurant) accessing endpoints, or cross-partner tampering. |
| `NOT_FOUND` | `404 Not Found` | Partner profile not found for user ID or target resource ID. |
| `CONFLICT` | `409 Conflict` | Attempting to create a second delivery profile for an already registered user. |

---

## 6. How to Test Endpoints Locally

### Prerequisites:
Make sure the backend is running locally on port 3000:
```bash
cd backend && npm run dev
```

### 1. Register a Delivery User
```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dev Delivery Partner",
    "email": "dev.delivery@example.com",
    "password": "Password123!",
    "phone": "9876543210",
    "role": "delivery"
  }'
```

### 2. Login to Obtain JWT Token
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dev.delivery@example.com",
    "password": "Password123!"
  }' | python3 -c 'import sys, json; print(json.load(sys.stdin)["data"]["token"])')

echo "Token: $TOKEN"
```

### 3. Create Delivery Partner Profile
```bash
curl -i -X POST http://localhost:3000/api/partners \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleType": "Motorcycle"
  }'
```

### 4. Retrieve Profile & Dashboard
```bash
# Get Profile
curl -i http://localhost:3000/api/partners/me \
  -H "Authorization: Bearer $TOKEN"

# Get Dashboard Overview
curl -i http://localhost:3000/api/partners/dashboard \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Toggle Availability Online
```bash
curl -i -X PATCH http://localhost:3000/api/partners/availability \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "isAvailable": true
  }'
```

### 6. Verify Unauthorized Access is Rejected
```bash
curl -i http://localhost:3000/api/partners/me
# Returns HTTP 401 Unauthorized
```