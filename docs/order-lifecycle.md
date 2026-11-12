# Zaykaa Order Lifecycle & Delivery Assignment Specification

This document defines the canonical order state machine, transition authorization rules, cancellation reconciliation policies, and concurrency-safe delivery assignment workflows for **Zaykaa**.

---

## 1. Canonical Order Statuses

The platform enforces exactly **nine** immutable status values:

1. `Placed`: Order created and payment acknowledged by customer; waiting for restaurant response.
2. `Accepted`: Restaurant confirmed the order and agreed to prepare it.
3. `Preparing`: Kitchen has started cooking food.
4. `Ready for Pickup`: Food is cooked, packaged, and awaiting delivery partner handover.
5. `Picked Up`: Delivery partner verified the package and took possession from the restaurant.
6. `Out for Delivery`: Delivery partner is in transit to the customer's delivery address.
7. `Delivered`: Package successfully handed to customer (Terminal).
8. `Rejected`: Restaurant declined the order due to kitchen capacity, closure, or out-of-stock items (Terminal).
9. `Cancelled`: Customer revoked the order before preparation started (Terminal).

---

## 2. Order State Transition Matrix

```
                      +-------------------+
                      |      Placed       |
                      +-------------------+
                        /       |       \
       (Restaurant)    /        |        \  (Customer Cancel)
       Reject         /         |         \
                     v          v          v
          +------------+   +----------+   +-------------+
          |  Rejected  |   | Accepted |   |  Cancelled  |
          | (Terminal) |   +----------+   | (Terminal)  |
          +------------+        |         +-------------+
                                |               ^
                 (Restaurant)   |               | (Customer Cancel
                 Start Prep     |               |  before Prep)
                                v               |
                         +-------------+--------+
                         |  Preparing  | (Cancellation Forbidden Beyond Here)
                         +-------------+
                                |
                 (Restaurant)   | Packaging Complete
                                v
                      +-------------------+
                      | Ready for Pickup  |
                      +-------------------+
                                |
                 (Delivery)     | Partner Takes Possession
                                v
                      +-------------------+
                      |     Picked Up     |
                      +-------------------+
                                |
                 (Delivery)     | Heading to Customer
                                v
                      +-------------------+
                      | Out for Delivery  |
                      +-------------------+
                                |
                 (Delivery)     | Drop-off Complete
                                v
                      +-------------------+
                      |     Delivered     |
                      |    (Terminal)     |
                      +-------------------+
```

### Transition Authorization Table

| Current Status | Next Allowed Status | Authorized Actor | Preconditions & Validation Rules | Is Terminal? |
| :--- | :--- | :--- | :--- | :--- |
| *(None)* | `Placed` | `customer` | Order validated against active menu items, stock available, pricing calculated on server. | No |
| `Placed` | `Accepted` | `restaurant` | Requesting user must own `order.restaurantId`. | No |
| `Placed` | `Rejected` | `restaurant` | Requesting user must own `order.restaurantId`. Reason recorded. | **Yes** |
| `Placed` | `Cancelled` | `customer` | Requesting user must be `order.customerId`. Allowed immediately. | **Yes** |
| `Accepted` | `Preparing` | `restaurant` | Requesting user must own `order.restaurantId`. Kitchen begins cooking. | No |
| `Accepted` | `Cancelled` | `customer` | Requesting user must be `order.customerId`. Permitted strictly before preparation commences. | **Yes** |
| `Preparing` | `Ready for Pickup` | `restaurant` | Requesting user must own `order.restaurantId`. Food packaged. | No |
| `Ready for Pickup`| `Picked Up` | `delivery` | Requesting partner must match `order.deliveryPartnerId`. Package verified. | No |
| `Picked Up` | `Out for Delivery` | `delivery` | Requesting partner must match `order.deliveryPartnerId`. Partner en route. | No |
| `Out for Delivery`| `Delivered` | `delivery` | Requesting partner must match `order.deliveryPartnerId`. Cash/drop-off verified. | **Yes** |

---

## 3. Strict Lifecycle Enforcement Rules

1. **Sequential Progression (No Skipping):** Statuses must advance strictly through the state machine. An order cannot jump directly from `Placed` to `Ready for Pickup` or from `Accepted` to `Delivered`.
2. **Terminal Invariance:** Once an order enters `Delivered`, `Rejected`, or `Cancelled`, its status can **never** be updated again. Any further transition request must return `400 Bad Request` (`CANNOT_TRANSITION_TERMINAL_ORDER`).
3. **Actor Ownership Verification:**
   - **Customer Operations:** `req.user.id === order.customerId`.
   - **Restaurant Operations:** The authenticated user's restaurant must equal `order.restaurantId` (`restaurant.ownerId === req.user.id`).
   - **Delivery Operations:** The authenticated user's partner profile must equal `order.deliveryPartnerId` (`partner.userId === req.user.id`).

---

## 4. Cancellation & Rejection Reconciliation Policy

- **Customer Cancellation Window:**
  - Allowed when status is `Placed` or `Accepted`.
  - Once the restaurant advances status to `Preparing`, preparation is legally underway and ingredients are committed. Customer cancellation attempts return `400 Bad Request` with code `CANCELLATION_DISALLOWED_PREPARATION_STARTED`.
- **Restaurant Rejection Window:**
  - Restaurants may reject an incoming order only while in `Placed` status.
  - Once accepted, restaurants cannot arbitrarily cancel without administrative override.

---

## 5. Delivery Assignment Workflow & Concurrency Rules

### A. Delivery Pool Eligibility
An order enters the **Available Delivery Pool** when:
1. Status is `Accepted`, `Preparing`, or `Ready for Pickup`.
2. `order.deliveryPartnerId === null` (unclaimed).

### B. Partner Visibility Rules
A delivery partner can view available orders on their dashboard (`GET /api/partners/dashboard`) if and only if:
- Authenticated role is `delivery`.
- Partner profile has `isAvailable === true` (active duty).
- Partner has no existing assignment (`activeOrderId === null`).

### C. Atomic Assignment Claim (`PATCH /api/partners/orders/:id/accept`)
- **Single Active Order Rule:** A delivery partner may have **at most one** active order at any given moment.
- **Race Condition Prevention (Concurrency Safety):**
  - If Partner A and Partner B simultaneously attempt to claim the same order:
    1. The storage layer uses an atomic check-and-set or serialized file write lock.
    2. The first request successfully sets `order.deliveryPartnerId = partnerA.id` and updates `partnerA.activeOrderId = order.id`.
    3. The second request detects `order.deliveryPartnerId !== null` and fails immediately with `409 Conflict` (`ORDER_ALREADY_ASSIGNED`).
- **Status Independence:** Accepting an assignment **does not** change `order.status`. The order remains in its current culinary status (`Accepted`, `Preparing`, or `Ready for Pickup`).

### D. Handover and Transit Execution
1. **Pickup Eligibility:** The assigned delivery partner can only mark `Picked Up` (`PATCH /api/partners/orders/:id/pickup`) once the restaurant has set `order.status = "Ready for Pickup"`. If the partner attempts pickup while still `Preparing`, the API returns `400 Bad Request` (`ORDER_NOT_READY_FOR_PICKUP`).
2. **Transit Update:** Partner invokes `PATCH /api/partners/orders/:id/out-for-delivery` when leaving the restaurant premises.
3. **Delivery Completion:** Partner invokes `PATCH /api/partners/orders/:id/deliver` at the customer location:
   - Sets `order.status = "Delivered"`.
   - Resets `partner.activeOrderId = null`.
   - Increments `partner.totalDeliveries += 1`.
   - Order lifecycle reaches terminal state.
