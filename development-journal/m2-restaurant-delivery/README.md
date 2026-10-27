# Member 2 (M2) — Restaurant & Delivery Journal

Development notes maintained by **Member 2 (M2)** on branch `feature/restaurant-delivery`.

---

## Domain Responsibilities

- Restaurant dashboard, operating profile, and menu item CRUD UI (`frontend/restaurant/`)
- Delivery partner dashboard, route overview, and status updates (`frontend/delivery/`)
- Restaurant profile & menu management APIs (`/api/restaurants`, `/api/restaurants/:id/menu`)
- Incoming order queue & status transition APIs (`PATCH /api/orders/:id/status`)
- Delivery partner management APIs (`/api/partners`)

---

## Entries Index

All entries use `.txt` format and follow the 6-section template defined in [`../README.md`](../README.md).

| Entry File | Prompt | Title | Status | Date |
|---|---|---|---|---|
| [`01-restaurant-crud.txt`](01-restaurant-crud.txt) | M2 Prompt 2.0 | Restaurant Profile CRUD Backend Implementation | Completed | 2026-10-26 |
| [`02-menu-crud.txt`](02-menu-crud.txt) | M2 Prompt 2.1 | Restaurant Menu CRUD Backend | Completed | 2026-10-27 |
| [`03-delivery-partner-profile.txt`](03-delivery-partner-profile.txt) | M2 Prompt 2.2 | Delivery Partner Profile & Availability APIs | Completed | 2026-10-27 |
| *Upcoming* | Prompt 2.3 | `04-delivery-partner-portal.txt` | Planned | — |