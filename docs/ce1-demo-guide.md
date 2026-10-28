# Zaykaa — CE-1 Demonstration Script & Evaluation Guide

**Target Audience:** University Evaluators, Faculty, & Student Demonstrators  
**Evaluation Scope:** CE-1 Progress Demonstration (Independent Module Functionality)  
**Modules Demonstrated:** Restaurant Partner Dashboard & Delivery Partner Fleet Console  
**Design Identity:** Zaykaa Gold Leaf  

---

## 1. Quick Start Commands

Execute the following commands from the project root directory in your terminal:

```bash
# 1. Navigate to the backend directory
cd backend

# 2. Reset / Initialize the realistic CE-1 demonstration data
npm run seed

# 3. Start the Express backend server (serves both API & Frontend at port 3000)
npm run dev
# (or for production mode: npm start)
```

The server will confirm:
```
[Server] Express listening on http://localhost:3000
[Static] Serving frontend from .../Zaykaa/frontend
```

---

## 2. Demo Credentials

Use these pre-configured fictional demo accounts. All passwords are set to the standard testing password:

| Role | Name | Email Address | Password | Profile Key Details |
|---|---|---|---|---|
| **Restaurant Owner** | Chef Rajinder Sharma | `chef.sharma@zaykaa.com` | `Password123!` | Manages *Campus Zaika Central* (Open) |
| **Delivery Courier 1** | Vikram Malhotra | `rider.vikram@zaykaa.com` | `Password123!` | Active courier on Motorcycle with 1 assigned delivery |
| **Delivery Courier 2** | Ramesh Patel | `rider.ramesh@zaykaa.com` | `Password123!` | Idle courier on Electric Vehicle ready to claim orders |

> [!NOTE]
> Demo accounts are pre-seeded in `backend/data/users.json`. If you accidentally log out or alter data during the presentation, running `npm run seed` instantly restores all records to their pristine state.

---

## 3. Frontend URLs & Navigable Views Inventory

The server delivers all dashboards directly at port 3000:

| Portal Name | Direct URL | Default View | Access Control |
|---|---|---|---|
| **Platform Landing Page** | `http://localhost:3000/index.html` | Architecture status | Public |
| **Restaurant Partner Dashboard** | `http://localhost:3000/restaurant/index.html` | Overview (`#overview`) | Role: `restaurant` |
| **Delivery Fleet Console** | `http://localhost:3000/delivery/index.html` | Overview (`#overview`) | Role: `delivery` |
| **Customer Portal Entry Point** | `http://localhost:3000/customer/` | *(M1 Placeholder)* | Role: `customer` (In Dev) |

---

## 4. Recommended Demonstration Flow (Step-by-Step)

Follow this structured 5-minute presentation sequence for optimal clarity and impact:

### Step 1: Open the Restaurant Dashboard (2 minutes)
1. Open browser tab: `http://localhost:3000/restaurant/index.html`.
2. **Sign In:** Enter `chef.sharma@zaykaa.com` and `Password123!`.
3. **Overview Screen:**
   - **Point out:** The Gold Leaf botanical hero banner (`🌿 Zaykaa Gold Leaf Kitchen Console`), operational status pill (`🟢 Kitchen Open`), and dynamic KPI cards:
     - Total Orders: `16`
     - Pending Preparation: `6`
     - Ready for Pickup: `3`
     - Completed Revenue: `₹1,054.50` (formatted directly from integer paise).
   - **Demonstrate:** Click the theme toggle button (`☀️ Light` / `🌙 Dark`) in the top header. Highlight that the background switches between warm ivory (`#FAF7F0`) and obsidian charcoal (`#101311`) instantly without page reload.
4. **Incoming Orders Queue (Click "Incoming Orders" in sidebar):**
   - **Explain:** The chronological queue of student orders from hostel blocks.
   - **Click Filter Pills:** Filter by `Placed` (2 orders), `Accepted` (2 orders), `Preparing` (2 orders), and `Ready for Pickup` (3 orders).
   - **Live Lifecycle Action Demonstration:**
     - On order `ord_demo_01` (`Placed`), click **"Accept"**. Notice the order badge instantly transitions to `Accepted` with a green olive toast.
     - On an accepted order, click **"Start Cooking"**. Notice it moves to `Preparing`.
     - On a preparing order, click **"Mark Ready"**. Notice it transitions to `Ready for Pickup` and displays `Awaiting Courier`.
5. **Menu Catalog Management (Click "Menu Catalog" in sidebar):**
   - **Explain:** 15 dishes across North Indian, Chinese, Snacks, Beverages, and South Indian.
   - **Point out:** Dish `Amritsari Kulcha with Chole` displays the red `Out of Stock` badge (`isAvailable: false`).
   - **Live Toggle:** Click the availability toggle on any dish. Notice the badge updates and the change is persisted to `menus.json`.
6. **Restaurant Profile & Theme Synchronization (Click "Restaurant Profile"):**
   - **Show:** The store hours toggle and the 3-button Appearance Theme switcher (`Light Mode`, `Dark Mode`, `System Default`).
   - **Explain:** Click `Light Mode`. Notice both the profile selector and the top header toggle stay synchronized.

---

### Step 2: Open the Delivery Fleet Console (2 minutes)
1. Open a second browser window / tab: `http://localhost:3000/delivery/index.html`.
2. **Sign In:** Enter `rider.vikram@zaykaa.com` and `Password123!`.
3. **Overview Screen:**
   - **Show:** Courier profile banner for *Vikram Malhotra*, vehicle type (`Motorcycle`), and total completed deliveries (`42`).
   - **Show:** Active assignment snapshot card displaying order `ord_demo_10` destined for *PG Hostel Wing A, Room 218*.
4. **Active Delivery Tracking (Click "Active Delivery" in sidebar):**
   - **Explain:** The 4-stage courier lifecycle stepper:
     - `1. Kitchen Prep` → `2. Ready for Pickup` → `3. Picked Up` → `4. Out for Delivery`.
   - **Show:** Current status is stage 4 (`Out for Delivery`).
   - **Demonstrate Delivery Completion:** Click **"Complete Handover"** (`btn-primary`).
   - **Observe:** The active order completes, total deliveries increment, and the active view transitions to an idle state.
5. **Discover Available Orders (Click "Available Orders" in sidebar):**
   - **Explain:** Shows orders in `Ready for Pickup` status waiting for couriers to claim.
   - **Show:** Pickup point (*Campus Zaika Central*), customer drop-off address, and delivery fee (`₹40.00`).
   - **Demonstrate Atomic Claim:** Click **"Accept Delivery"** on any available order.
   - **Observe:** The order is instantly claimed and moves into the Active Delivery tab. The backend enforces our invariant: *A courier can only hold one active order at a time*.
6. **Delivery History (Click "Delivery History" in sidebar):**
   - **Explain:** Aggregated payout summary showing total delivery fees earned (`₹120.00+`) and historical delivery log table.

---

### Step 3: Responsive & Mobile Verification (1 minute)
1. Open Developer Tools (Press `F12` or `Cmd+Option+I`) and toggle device toolbar.
2. Select **iPhone 14 / Mobile (390px)** width:
   - **Demonstrate:** On mobile, the navigation neatly transforms into a slide-out drawer via the hamburger button (`☰`).
   - **Demonstrate:** Touch-friendly 48px action buttons, compact stat grids, and zero horizontal page overflow.

---

## 5. How to Reset Demo Data After Testing

During the demo, when you click status buttons (e.g. Accept, Complete Handover, or Claim), the JSON records in `backend/data/orders.json` and `delivery_partners.json` change state.

To reset all records back to the original demo state:
```bash
# In the backend terminal:
npm run seed
```
Then simply click the **"↻ Refresh"** button in the dashboard top header. All data will instantly reset!

---

## 6. Faculty Presentation Summary: Division of Work

When evaluators ask how the project was developed, provide this concise breakdown:

> *"For CE-1, our team established clear architectural boundaries. **Member 1** owns the Customer module on `feature/customer`, including customer browsing, cart management in localStorage, and checkout endpoints.*
> 
> ***Member 2** owns the Restaurant and Delivery Partner modules on `feature/restaurant-delivery`, including the Restaurant Kitchen Dashboard, Menu CRUD, Incoming Orders Queue, Delivery Assignment Workflow, and the shared Gold Leaf design system.*
> 
> *Both developers share the Express API pipeline, JWT authentication middleware, and our custom concurrency-safe JSON storage engine (`jsonStore.js`). For this evaluation, we are demonstrating Restaurant and Delivery independently using realistic campus data. Full cross-module checkout-to-doorstep integration will occur in our next phase after branch convergence."*
