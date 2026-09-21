const DATABASE_NAME = 'labelguard-manufacturer-artwork';
const DATABASE_VERSION = 1;
const STORE_NAME = 'artwork-images';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open the artwork image store.'));
  });
}

function imageId() {
  return `MFG-IMG-${crypto.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}

export async function saveImage(file, metadata = {}) {
  if (!(file instanceof Blob)) throw new Error('A package artwork image is required.');
  const record = {
    id: imageId(),
    blob: file,
    panel: metadata.panel || 'principal',
    filename: metadata.filename || file.name || 'package-artwork',
    contentType: metadata.contentType || file.type || null,
    createdAt: new Date().toISOString(),
  };
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => { database.close(); resolve({ ...record, blob: undefined }); };
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error('Could not save the artwork image.')); };
    transaction.onabort = () => { database.close(); reject(transaction.error || new Error('Artwork image save was aborted.')); };
  });
}

export async function getImage(id) {
  if (!id) return null;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => { database.close(); resolve(request.result || null); };
    request.onerror = () => { database.close(); reject(request.error || new Error('Could not retrieve the artwork image.')); };
  });
}

export async function deleteImage(id) {
  if (!id) return;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error('Could not remove the artwork image.')); };
  });
}
