import { openDB } from 'idb';

const DB_NAME = 'deepscroll-db';
const STORE_NAME = 'slices';

export async function initDB() {
    return openDB(DB_NAME, 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        },
    });
}

export async function saveSlice(dataUrl) {
    const db = await initDB();
    const id = await db.put(STORE_NAME, { dataUrl, createdAt: Date.now() });
    return id;
}

export async function getSlice(id) {
    const db = await initDB();
    return db.get(STORE_NAME, id);
}

export async function getAllSlices() {
    const db = await initDB();
    return db.getAll(STORE_NAME);
}

export async function clearSlices() {
    const db = await initDB();
    return db.clear(STORE_NAME);
}
