# Zaykaa JSON Storage Engine & Repository Contract

This document specifies the technical design, serialization rules, atomic write protocols, and repository interfaces for the **CE-1 JSON Storage Engine** in **Zaykaa**.

---

## 1. Data Store Layout (`backend/data/`)

Persistent data for CE-1 is stored as formatted JSON arrays in the `backend/data/` directory:

| Filename | Domain Entity | Initial State |
| :--- | :--- | :--- |
| `backend/data/users.json` | Platform users (Customers, Restaurant Owners, Delivery Partners) | `[]` |
| `backend/data/restaurants.json` | Restaurant profiles and operational settings | `[]` |
| `backend/data/menus.json` | Menu items categorized by restaurant | `[]` |
| `backend/data/orders.json` | Canonical multi-party order records | `[]` |
| `backend/data/delivery_partners.json` | Delivery partner status, vehicle types, and active order tracking | `[]` |

---

## 2. ID Generation Standard

Primary keys are generated using Node.js's native `crypto.randomUUID()` combined with domain-specific prefixes:

```javascript
import crypto from 'crypto';

export const generateId = (prefix) => `${prefix}_${crypto.randomUUID()}`;

// Examples:
// generateId('usr')  -> "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
// generateId('rst')  -> "rst_4a7c1b23-8e9f-4321-a012-3456789abcde"
// generateId('item') -> "item_f1e2d3c4-b5a6-4789-8012-3456789abcde"
// generateId('ord')  -> "ord_10293847-5678-4321-abcd-ef0123456789"
// generateId('del')  -> "del_e8f7a6b5-c4d3-4210-9876-543210fedcba"
```

---

## 3. Missing & Corrupt File Handling

To prevent crashes on a fresh clone or deployment:
1. **Auto-Initialization:** If a required JSON file does not exist when a repository is initialized, the repository must automatically create the file populated with `[]`.
2. **Corrupt File Recovery:** If `JSON.parse()` fails due to empty or malformed files, the adapter logs a critical warning and safely initializes in-memory state to `[]` to prevent server crashes.

---

## 4. Canonical Repository Method Signatures

Every repository (`<feature>.repository.js`) must implement the standard asynchronous CRUD contract:

```javascript
/**
 * Generic Repository Interface
 */
export interface BaseRepository<T> {
  /**
   * Finds a single entity by its unique ID.
   * @param id Entity identifier string
   * @returns Entity object if found, or null if not found.
   */
  findById(id: string): Promise<T | null>;

  /**
   * Retrieves all entities, optionally filtered by a predicate function.
   * @param filterFn Optional predicate (item => boolean)
   * @returns Array of matching entity objects.
   */
  findAll(filterFn?: (item: T) => boolean): Promise<T[]>;

  /**
   * Persists a new entity with generated ID and timestamps.
   * @param data Entity creation attributes
   * @returns Newly created and saved entity.
   */
  create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>;

  /**
   * Updates an existing entity by ID.
   * @param id Entity identifier
   * @param updateData Partial fields to update
   * @returns Updated entity, or null if entity does not exist.
   */
  update(id: string, updateData: Partial<T>): Promise<T | null>;

  /**
   * Removes an entity by ID.
   * @param id Entity identifier
   * @returns True if deleted, false if entity was not found.
   */
  delete(id: string): Promise<boolean>;
}
```

---

## 5. Concurrency Protection & Atomic Write Strategy

In high-concurrency scenarios (such as two delivery partners simultaneously attempting to accept an order), naïve `fs.writeFile` operations can cause race conditions or corrupt JSON files.

### A. Per-Collection In-Memory Write Queue (Mutex)
All write operations (`create`, `update`, `delete`) for a given collection are piped through an in-memory sequential Promise chain:

```javascript
let writeQueue = Promise.resolve();

const queueWrite = (operation) => {
  writeQueue = writeQueue.then(operation).catch(err => {
    console.error("Storage Write Error:", err);
    throw err;
  });
  return writeQueue;
};
```

### B. Atomic File Replacement (Write-and-Rename)
Direct writes to target files risk data loss if the process crashes mid-stream. The storage engine enforces atomic writes using `fs.promises.rename`:

1. Serialize data to JSON string.
2. Write string to temporary sibling file: `backend/data/<filename>.json.tmp`.
3. Flush and atomically rename `backend/data/<filename>.json.tmp` $\to$ `backend/data/<filename>.json`.
4. The OS atomic rename guarantees that readers always observe either the complete previous file or the complete new file—never a corrupted partial write.

---

## 6. CE-2 MongoDB / Mongoose Migration Compatibility

The repository contract is engineered to enable a zero-rewrite transition in CE-2:

```
[Service Layer]
       │
       │ Calls repository.findById(id), repository.create(data), etc.
       ▼
[Repository Interface]
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[CE-1: JSON Repository]          [CE-2: Mongoose Repository]
(backend/data/*.json)            (Mongoose Models -> MongoDB)
```

- **Service Independence:** Services never import `fs`, never inspect file paths, and never manage file locks.
- **POJO Uniformity:** Repositories always return Plain Old JavaScript Objects (POJOs), ensuring identical consumption whether data originates from local JSON or remote MongoDB clusters.
