import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { JsonStore, generateId } from '../src/utils/jsonStore.js';

describe('JsonStore Foundation Tests', () => {
  let tempDir;
  let store;

  beforeEach(async () => {
    // Create an isolated temporary directory for test collections
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zaykaa-test-'));
    store = new JsonStore(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary test directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  test('1. Reading an empty collection returns an empty array', async () => {
    await fs.writeFile(path.join(tempDir, 'empty.json'), '[]\n', 'utf8');
    const result = await store.readCollection('empty');
    assert.deepEqual(result, []);
  });

  test('2. Creating a record generates prefix ID, timestamps, and persists to disk', async () => {
    const created = await store.create('users', { name: 'Kunal', role: 'customer' }, 'usr');
    
    assert.ok(created.id.startsWith('usr_'));
    assert.equal(created.name, 'Kunal');
    assert.equal(created.role, 'customer');
    assert.ok(created.createdAt);
    assert.ok(created.updatedAt);

    // Verify raw file content on disk
    const content = JSON.parse(await fs.readFile(path.join(tempDir, 'users.json'), 'utf8'));
    assert.equal(content.length, 1);
    assert.equal(content[0].id, created.id);
  });

  test('3. Retrieving a record by ID returns the correct entity', async () => {
    const created = await store.create('restaurants', { name: 'Spice Symphony' }, 'rst');
    const fetched = await store.findById('restaurants', created.id);

    assert.ok(fetched);
    assert.equal(fetched.id, created.id);
    assert.equal(fetched.name, 'Spice Symphony');
  });

  test('4. Updating a record updates fields and updatedAt while preserving id and createdAt', async () => {
    const original = await store.create('menus', { name: 'Butter Naan', price: 5000 }, 'item');
    
    // Brief pause to ensure distinct timestamp
    await new Promise((resolve) => setTimeout(resolve, 10));

    const updated = await store.update('menus', original.id, { price: 6000 });
    assert.ok(updated);
    assert.equal(updated.id, original.id);
    assert.equal(updated.price, 6000);
    assert.equal(updated.createdAt, original.createdAt);
    assert.notEqual(updated.updatedAt, original.createdAt);

    const refetched = await store.findById('menus', original.id);
    assert.equal(refetched.price, 6000);
  });

  test('5. Deleting a record removes it from the collection', async () => {
    const item1 = await store.create('items', { name: 'Item 1' }, 'item');
    const item2 = await store.create('items', { name: 'Item 2' }, 'item');

    const deleteResult = await store.delete('items', item1.id);
    assert.equal(deleteResult, true);

    const all = await store.findAll('items');
    assert.equal(all.length, 1);
    assert.equal(all[0].id, item2.id);

    const deletedLookup = await store.findById('items', item1.id);
    assert.equal(deletedLookup, null);
  });

  test('6. Handling a missing ID returns null or false gracefully', async () => {
    const nonExistentId = 'usr_00000000-0000-0000-0000-000000000000';
    
    const findResult = await store.findById('users', nonExistentId);
    assert.equal(findResult, null);

    const updateResult = await store.update('users', nonExistentId, { name: 'Ghost' });
    assert.equal(updateResult, null);

    const deleteResult = await store.delete('users', nonExistentId);
    assert.equal(deleteResult, false);

    assert.equal(await store.findById('users', null), null);
    assert.equal(await store.update('users', null, {}), null);
    assert.equal(await store.delete('users', null), false);
  });

  test('7. Handling missing collection files auto-initializes with empty array', async () => {
    const missingFilePath = path.join(tempDir, 'auto_init.json');
    
    // Confirm file does not exist initially
    await assert.rejects(fs.access(missingFilePath));

    const items = await store.readCollection('auto_init');
    assert.deepEqual(items, []);

    // Confirm file now exists on disk with []
    const content = await fs.readFile(missingFilePath, 'utf8');
    assert.deepEqual(JSON.parse(content), []);
  });

  test('8. Handling malformed JSON throws without corrupting or losing data', async () => {
    const malformedPath = path.join(tempDir, 'corrupted.json');
    const originalCorruptContent = '{ invalid json syntax ...';
    await fs.writeFile(malformedPath, originalCorruptContent, 'utf8');

    // Attempting to read must throw an explicit error
    await assert.rejects(
      async () => {
        await store.readCollection('corrupted');
      },
      (err) => err instanceof SyntaxError || err.message.includes('Corrupted collection')
    );

    // Verify original corrupted content was preserved and not silently overwritten
    const preservedContent = await fs.readFile(malformedPath, 'utf8');
    assert.equal(preservedContent, originalCorruptContent);
  });

  test('9. Concurrent writes are serialized without lost updates', async () => {
    const concurrencyCount = 25;
    const promises = [];

    // Launch 25 concurrent create operations simultaneously
    for (let i = 0; i < concurrencyCount; i++) {
      promises.push(store.create('concurrent_orders', { index: i, amount: (i + 1) * 1000 }, 'ord'));
    }

    const results = await Promise.all(promises);
    assert.equal(results.length, concurrencyCount);

    // Verify on disk that all 25 records were saved with no lost updates
    const all = await store.findAll('concurrent_orders');
    assert.equal(all.length, concurrencyCount);

    const indices = all.map((o) => o.index).sort((a, b) => a - b);
    assert.deepEqual(indices, Array.from({ length: concurrencyCount }, (_, i) => i));
  });

  test('10. Preserves valid JSON format after repeated CRUD operations', async () => {
    const created = await store.create('history', { counter: 1 }, 'rec');
    
    for (let i = 2; i <= 10; i++) {
      await store.update('history', created.id, { counter: i });
    }

    const rawContent = await fs.readFile(path.join(tempDir, 'history.json'), 'utf8');
    assert.doesNotThrow(() => JSON.parse(rawContent));

    const parsed = JSON.parse(rawContent);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].counter, 10);
  });
});
