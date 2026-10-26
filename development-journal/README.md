# Zaykaa — Development Journal

Live technical log, viva preparation resource, and contribution tracker for the **Zaykaa** food delivery platform.

---

## 1. Directory Structure

```text
development-journal/
├── README.md                          # Journal index & documentation guide (this file)
├── m1-customer/                       # Member 1 entries (Customer Portal & Ordering)
│   └── README.md
├── m2-restaurant-delivery/            # Member 2 entries (Restaurant & Delivery Portals)
│   └── README.md
├── shared/                            # Shared milestones (Architecture, Auth, Order Core)
│   ├── README.md
│   └── 01-project-initialization.txt  # Prompt 1.0 setup entry
└── viva-preparation/                  # Viva revision notes & concept summaries
    └── README.md
```

---

## 2. Member Ownership & Workflow

| Role | Branch | Directory | Entry Extension |
| :--- | :--- | :--- | :--- |
| **Member 1 (M1)** | `feature/customer` | `m1-customer/` | `.txt` |
| **Member 2 (M2)** | `feature/restaurant-delivery` | `m2-restaurant-delivery/` | `.txt` |
| **Shared** | `main` / `develop` | `shared/` | `.txt` |

- **Automatic Logging:** After each completed coding prompt, create or update the corresponding `.txt` file in the appropriate folder.
- **Naming Convention:** Use local numbering per folder (e.g., `01-restaurant-crud.txt`, `02-order-management.txt`).
- **No Overwriting:** Never modify another member's folder or entries without approval.

---

## 3. Standard Journal Entry Format (Target: 30–60 lines)

Every `.txt` entry must follow this concise 6-section template:

```text
================================================================================
ZAYKAA DEVELOPMENT JOURNAL — ENTRY [NUMBER] ([M1/M2/SHARED])
================================================================================
Task: Prompt [Number] — [Feature / Module Name]
Developer: [M1 / M2 / Shared] | Date: YYYY-MM-DD | Status: [Completed]

1. WHAT WE BUILT
- Short bullet points summarizing what was actually built and verified.

2. HOW IT WORKS
- Simple step-by-step explanation of the data flow and mechanism.

3. TECHNOLOGIES & CONCEPTS
- Key tools/concepts used (Node.js, Express, methods, patterns) and WHY each was used in Zaykaa.

4. IMPORTANT FILES
- List created or modified files with 1-line descriptions of their responsibilities.

5. TESTING & RESULTS
- Exact commands run (npm, curl), endpoints tested, HTTP status codes, and outputs.

6. VIVA QUESTIONS & ANSWERS
- 3–5 meaningful viva questions with concise, technically accurate answers.
================================================================================
```
