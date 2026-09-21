const DATABASE_NAME = 'labelguard-seller-listing-images';
const STORE_NAME = 'listing-images';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open the Seller image store.'));
  });
}

export async function saveSellerImage(file, metadata = {}) {
  if (!(file instanceof Blob)) throw new Error('A listing image is required.');
  const record = { id: `SELLER-IMG-${crypto.randomUUID?.() || Date.now().toString(36)}`, blob: file, role: metadata.role || 'listing', filename: metadata.filename || file.name || 'listing-image', contentType: metadata.contentType || file.type || null, createdAt: new Date().toISOString() };
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => { database.close(); resolve({ ...record, blob: undefined }); };
    transaction.onerror = () => { database.close(); reject(transaction.error || new Error('Could not save the listing image.')); };
  });
}

export async function getSellerImage(id) {
  if (!id) return null;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => { database.close(); resolve(request.result || null); };
    request.onerror = () => { database.close(); reject(request.error || new Error('Could not retrieve the listing image.')); };
  });
}
