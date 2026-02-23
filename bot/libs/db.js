const path = require('path');
let db = null;
let dbInitialized = false;
let writeInProgress = false; // Защита от race condition
const writeQueue = []; // Очередь операций записи

// Initialize lowdb async (compatible with lowdb v7+ ESM/CommonJS)
async function initDb() {
  if (db) return db;
  // Use dynamic import for ESM module support
  const { Low } = await import('lowdb');
  const { JSONFile } = await import('lowdb/node');
  
  const dbFile = path.join(__dirname, '..', '..', 'db.json');
  const adapter = new JSONFile(dbFile);
  
  // v7 Low constructor takes adapter and default data
  const defaultData = { 
    welcome: null, 
    stats: { aiRequests: 0 }, 
    rulesPosted: null, 
    supportPanelPosted: null,
    pets: {},         // { petId: { owner_id, species, breed, name, thread_id, status, age_weeks, stats: { lastFed, lastBathed, lastWalked, lastCleaned, petsCount, beNear } } }
    threads: {},      // { thread_id: pet_id }
    petManagementMsg: null // { channelId, messageId }
  };
  db = new Low(adapter, defaultData);
  
  await db.read();
  
  // Ensure default data if file was empty or missing
  db.data = db.data || defaultData;
  
  await db.write();
  dbInitialized = true;
  return db;
}

// Безопасная запись с защитой от race condition
async function safeWrite() {
  if (writeInProgress) {
    return new Promise((resolve) => {
      writeQueue.push(resolve);
    });
  }
  
  writeInProgress = true;
  try {
    await db.write();
  } catch (e) {
    if (e.code !== 'EPERM') throw e;
    console.warn('[DB] Write warning (EPERM):', e.message);
  } finally {
    writeInProgress = false;
    if (writeQueue.length > 0) {
      const resolve = writeQueue.shift();
      resolve();
      await safeWrite();
    }
  }
}

// Initialize on module load
let dbReady = initDb().catch(e => console.error('DB init error:', e));

module.exports = {
  // Ensure DB is ready before any operation
  ensureReady: () => dbReady,
  
  set: async (k, v) => { 
    await dbReady;
    if (!db || !db.data) { console.warn('[DB] Not initialized for set'); return null; }
    db.data[k] = v; 
    try { 
      await safeWrite();
    } catch (e) { 
      if (e.code !== 'EPERM') throw e; 
      console.warn('[DB] Write warning (EPERM):', e.message); 
    } 
    return db.data[k]; 
  },
  
  get: (k) => {
    if (!dbInitialized || !db || !db.data) { 
      console.warn('[DB] Not yet initialized for get:', k);
      return null; 
    }
    return db.data[k];
  },
  
  incrementAi: async () => { 
    await dbReady;
    if (!db || !db.data) { console.warn('[DB] Not initialized for incrementAi'); return; }
    try {
      db.data.stats = db.data.stats || { aiRequests: 0 };
      db.data.stats.aiRequests = (db.data.stats.aiRequests || 0) + 1; 
      await safeWrite();
    } catch (e) { 
      if (e.code === 'EPERM') {
        console.warn('[DB] Write warning (file locked): incrementAi not persisted this time');
      } else {
        throw e;
      }
    }
  },
  
  all: () => {
    if (!dbInitialized || !db || !db.data) { 
      console.warn('[DB] Not yet initialized for all');
      return null; 
    }
    return db.data;
  },

  // === Pet Management Methods ===
  
  // Get all pets for a user
  getUserPets: (userId) => {
    if (!dbInitialized || !db || !db.data) return [];
    db.data.pets = db.data.pets || {};
    return Object.values(db.data.pets).filter(p => p.owner_id === userId);
  },

  // Get pet by ID
  getPet: (petId) => {
    if (!dbInitialized || !db || !db.data) return null;
    db.data.pets = db.data.pets || {};
    return db.data.pets[petId] || null;
  },

  // Add new pet
  addPet: async (petId, petData) => {
    await dbReady;
    if (!db || !db.data) { console.warn('[DB] Not initialized for addPet'); return null; }
    db.data.pets = db.data.pets || {};
    db.data.pets[petId] = {
      id: petId,
      owner_id: petData.owner_id,
      species: petData.species,
      breed: petData.breed,
      name: petData.name,
      thread_id: petData.thread_id,
      created_at: Date.now(),
      age_weeks: 0,
      status: 'healthy',
      stats: {
        lastFed: Date.now(),
        lastBathed: Date.now(),
        lastWalked: Date.now(),
        lastCleaned: Date.now(),
        petsCount: 0,        // кол-во поглаживаний сегодня
        beNearTime: 0        // секунды рядом сегодня
      }
    };
    if (petData.thread_id) {
      db.data.threads = db.data.threads || {};
      db.data.threads[petData.thread_id] = petId;
    }
    try { await safeWrite(); } catch (e) { console.warn('[DB] Write warning:', e.message); }
    return db.data.pets[petId];
  },

  // Update pet stats
  updatePetStats: async (petId, updates) => {
    await dbReady;
    if (!db || !db.data) { console.warn('[DB] Not initialized for updatePetStats'); return null; }
    db.data.pets = db.data.pets || {};
    if (!db.data.pets[petId]) return null;
    db.data.pets[petId] = { ...db.data.pets[petId], ...updates };
    try { await safeWrite(); } catch (e) { console.warn('[DB] Write warning:', e.message); }
    return db.data.pets[petId];
  },

  // Delete pet
  deletePet: async (petId) => {
    await dbReady;
    if (!db || !db.data) { console.warn('[DB] Not initialized for deletePet'); return null; }
    db.data.pets = db.data.pets || {};
    db.data.threads = db.data.threads || {};
    const pet = db.data.pets[petId];
    if (pet && pet.thread_id) {
      delete db.data.threads[pet.thread_id];
    }
    delete db.data.pets[petId];
    try { await safeWrite(); } catch (e) { console.warn('[DB] Write warning:', e.message); }
    return pet;
  },

  // Get pet by thread ID
  getPetByThread: (threadId) => {
    if (!dbInitialized || !db || !db.data) return null;
    db.data.threads = db.data.threads || {};
    const petId = db.data.threads[threadId];
    if (!petId) return null;
    return module.exports.getPet(petId);
  },

  // Store pet management message info
  setPetManagementMessage: async (channelId, messageId) => {
    await dbReady;
    if (!db || !db.data) { console.warn('[DB] Not initialized for setPetManagementMessage'); return null; }
    db.data.petManagementMsg = { channelId, messageId };
    try { await safeWrite(); } catch (e) { console.warn('[DB] Write warning:', e.message); }
    return db.data.petManagementMsg;
  },

  // Get pet management message info
  getPetManagementMessage: () => {
    if (!dbInitialized || !db || !db.data) return null;
    return db.data.petManagementMsg || null;
  }
};