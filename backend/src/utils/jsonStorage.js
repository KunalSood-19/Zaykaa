import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');

// In-memory queue per file path to prevent concurrent write collisions
const writeQueues = new Map();

/**
 * Ensures the data directory and target JSON file exist.
 * If file does not exist, initializes it with an empty array.
 */
const ensureFile = async (filePath) => {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, '[]\n', 'utf-8');
  }
};

/**
 * Asynchronously read and parse JSON data from disk.
 * Handles missing files and malformed JSON safely.
 */
export const readJson = async (fileName) => {
  const filePath = path.resolve(DATA_DIR, fileName);
  await ensureFile(filePath);

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const trimmed = raw.trim();
    if (!trimmed) {
      return [];
    }
    return JSON.parse(trimmed);
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`[JsonStorage] Malformed JSON in ${fileName}. Returning empty array fallback.`);
      return [];
    }
    throw error;
  }
};

/**
 * Asynchronously write JSON data using atomic file replacement and write queue.
 * Writing to a temporary file first ensures no data corruption if process terminates.
 */
export const writeJson = async (fileName, data) => {
  const filePath = path.resolve(DATA_DIR, fileName);
  await ensureFile(filePath);

  // Serialized execution per file
  const previousPromise = writeQueues.get(filePath) || Promise.resolve();

  const currentWrite = previousPromise.then(async () => {
    const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
    const serialized = JSON.stringify(data, null, 2) + '\n';
    try {
      await fs.writeFile(tempPath, serialized, 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch (err) {
      // Clean up orphaned temp file if write/rename failed
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore unlink error
      }
      throw err;
    }
  });

  writeQueues.set(filePath, currentWrite);

  try {
    await currentWrite;
  } finally {
    if (writeQueues.get(filePath) === currentWrite) {
      writeQueues.delete(filePath);
    }
  }
};
