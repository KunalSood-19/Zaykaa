# Appendix C: Data Model & Order Lifecycle Specification

**Course / Evaluation:** Continuous Evaluation 1 (CE-1) Progress Review
**Project Title:** Zaykaa — Multi-Sided Food Delivery Platform
**Sources of Truth:** [docs/data-models.md](file:///Users/tarshitgupta/Coding%20&%20Projects/Projects/Zaykaa/docs/data-models.md), [docs/order-lifecycle.md](file:///Users/tarshitgupta/Coding%20&%20Projects/Projects/Zaykaa/docs/order-lifecycle.md), and [backend/src/modules/orders/order.service.js](file:///Users/tarshitgupta/Coding%20&%20Projects/Projects/Zaykaa/backend/src/modules/orders/order.service.js)

---

## C1. Canonical Data Models

| Entity Name | Primary Key Prefix | Key Fields & Data Types | Relationships | Critical Validation Constraints |
|---|---|---|---|---|
| **User** (`users.json`) | `usr_<id>` | `name` (String, 2-80 chars)<br>`email` (String, unique)<br>`passwordHash` (String, bcrypt)<br>`phone` (String, 10-15 chars)<br>`role` (String Enum)<br>`createdAt`, `updatedAt` (ISO UTC) | Parent to Restaurant (`ownerId`) or Delivery Partner (`userId`); Customer in Order (`customerId`). | Single role assignment (`customer`, `restaurant`, or `delivery`). Password hash never exposed in API. |
| **Restaurant** (`restaurants.json`) | `rst_<id>` | `ownerId` (String FK)<br>`name` (String, 2-100 chars)<br>`description` (String)<br>`cuisineTypes` (Array of Strings)<br>`address` (Object: street, city, pincode)<br>`phone` (String)<br>`isOpen` (Boolean)<br>`createdAt`, `updatedAt` (ISO UTC) | Belongs to User (`ownerId`). Parent to Menu Items (`restaurantId`) and Orders (`restaurantId`). | Exactly one restaurant per user with role `restaurant`. Protected fields (`id`, `ownerId`) immutable. |
| **Menu Item** (`menus.json`) | `item_<id>` | `restaurantId` (String FK)<br>`name` (String, 2-100 chars)<br>`description` (String)<br>`category` (String Enum)<br>`price` (Integer paise)<br>`imageUrl` (String URL)<br>`isAvailable` (Boolean) | Belongs to Restaurant (`restaurantId`). Referenced in Order `items[].itemId`. | Monetary values strictly positive integers in paise (e.g. ₹150 = `15000`). Float values rejected. |
| **Order** (`orders.json`) | `ord_<id>` | `customerId` (String FK)<br>`restaurantId` (String FK)<br>`deliveryPartnerId` (String FK, nullable)<br>`status` (String Enum: 9 canonical states)<br>`items` (Array of item snapshots)<br>`pricing` (Object: subtotal, deliveryFee, tax, total in paise)<br>`deliveryAddress` (Object)<br>`timestamps` (Object of ISO UTC dates) | Belongs to Customer (`customerId`), Restaurant (`restaurantId`), and Delivery Partner (`deliveryPartnerId`). | Items must come from single restaurant. Status follows atomic transition state machine. Terminal states immutable. |
| **Delivery Partner** (`delivery_partners.json`) | `del_<id>` | `userId` (String FK)<br>`vehicleType` (String Enum: Motorcycle, Bicycle, EV, Scooter)<br>`isAvailable` (Boolean duty status)<br>`activeOrderId` (String FK, nullable)<br>`totalDeliveries` (Integer counter)<br>`createdAt`, `updatedAt` (ISO UTC) | Belongs to User (`userId`). Linked to currently assigned Order (`activeOrderId`). | Exactly one partner profile per `delivery` user. **One-active-order invariant:** `activeOrderId` must be `null` before claiming a new task. |

---

## C2. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USER ||--o| RESTAURANT : "owns (1:1)"
    USER ||--o| DELIVERY_PARTNER : "onboards as (1:1)"
    USER ||--o{ ORDER : "places (1:N as Customer)"
    RESTAURANT ||--o{ MENU_ITEM : "catalogs (1:N)"
    RESTAURANT ||--o{ ORDER : "fulfills (1:N)"
    DELIVERY_PARTNER ||--o{ ORDER : "delivers (1:N)"

    USER {
        string id PK "usr_..."
        string name
        string email UK
        string passwordHash
        string phone
        string role "customer | restaurant | delivery"
        datetime createdAt
        datetime updatedAt
    }

    RESTAURANT {
        string id PK "rst_..."
        string ownerId FK "usr_..."
        string name
        string description
        string[] cuisineTypes
        object address
        string phone
        boolean isOpen
        datetime createdAt
        datetime updatedAt
    }

    MENU_ITEM {
        string id PK "item_..."
        string restaurantId FK "rst_..."
        string name
        string description
        string category
        int price "Integer paise (₹1 = 100)"
        string imageUrl
        boolean isAvailable
    }

    DELIVERY_PARTNER {
        string id PK "del_..."
        string userId FK "usr_..."
        string vehicleType
        boolean isAvailable
        string activeOrderId FK "ord_... (Nullable)"
        int totalDeliveries
        datetime createdAt
        datetime updatedAt
    }

    ORDER {
        string id PK "ord_..."
        string customerId FK "usr_..."
        string restaurantId FK "rst_..."
        string deliveryPartnerId FK "del_... (Nullable)"
        string status "Canonical 9 States"
        object items "Snapshots with price in paise"
        object pricing "Subtotal, fee, tax, total"
        object deliveryAddress
        object timestamps
    }
```

---

## C3. Canonical Order Lifecycle State Machine

```mermaid
flowchart TD
    Placed([Placed]) -->|Restaurant Accepts| Accepted[Accepted]
    Placed -->|Restaurant Rejects| Rejected([Rejected 🛑])
    Placed -->|Customer Cancels| Cancelled([Cancelled 🛑])

    Accepted -->|Customer Cancels Early| Cancelled
    Accepted -->|Kitchen Starts Cooking| Preparing[Preparing]

    Preparing -->|Packaging Finished| ReadyForPickup[Ready for Pickup]

    ReadyForPickup -->|Partner Claims & Handover| PickedUp[Picked Up]

    PickedUp -->|Departing for Drop-off| OutForDelivery[Out for Delivery]

    OutForDelivery -->|Handover Completed| Delivered([Delivered 🏁])

    classDef terminal fill:#ffdddd,stroke:#cc0000,stroke-width:2px;
    classDef success fill:#ddffdd,stroke:#00aa00,stroke-width:2px;
    classDef active fill:#fff3cd,stroke:#e0a800,stroke-width:2px;

    class Rejected,Cancelled terminal;
    class Delivered success;
    class Placed,Accepted,Preparing,ReadyForPickup,PickedUp,OutForDelivery active;
```

---

## C4. State Transition Matrix & Implemented API Endpoints

| Current Status | Allowed Next Status | Responsible Role | Implementation Status | Implemented API Action |
|---|---|---|:---:|---|
| *(New Order)* | `Placed` | `customer` | **Planned (M1)** | `POST /api/orders` (Simulated via localStorage cart in CE-1) |
| `Placed` | `Accepted` | `restaurant` | **Implemented** | `PATCH /api/orders/:id/status` `{ "status": "Accepted" }` |
| `Placed` | `Rejected` | `restaurant` | **Implemented** | `PATCH /api/orders/:id/status` `{ "status": "Rejected" }` *(Terminal)* |
| `Placed` | `Cancelled` | `customer` | **Planned (M1)** | `POST /api/orders/:id/cancel` *(Terminal)* |
| `Accepted` | `Preparing` | `restaurant` | **Implemented** | `PATCH /api/orders/:id/status` `{ "status": "Preparing" }` |
| `Accepted` | `Cancelled` | `customer` | **Planned (M1)** | `POST /api/orders/:id/cancel` *(Terminal; forbidden once cooking starts)* |
| `Preparing` | `Ready for Pickup` | `restaurant` | **Implemented** | `PATCH /api/orders/:id/status` `{ "status": "Ready for Pickup" }` |
| `Ready for Pickup` | *(Assignment)* | `delivery` | **Implemented** | `PATCH /api/partners/orders/:id/accept` *(Sets `deliveryPartnerId`)* |
| `Ready for Pickup` | `Picked Up` | `delivery` | **Implemented** | `PATCH /api/partners/orders/:id/pickup` |
| `Picked Up` | `Out for Delivery` | `delivery` | **Implemented** | `PATCH /api/partners/orders/:id/out-for-delivery` |
| `Out for Delivery` | `Delivered` | `delivery` | **Implemented** | `PATCH /api/partners/orders/:id/deliver` *(Terminal; increments courier trips)* |
