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
  const lowdbModule = await import('lowdb/node');
  const JSONFile = lowdbModule.JSONFile;
  
  const dbFile = path.join(__dirname, '..', '..', 'db.json');
  const adapter = new JSONFile(dbFile);
  
  // v7 Low constructor takes adapter and default data
  const defaultData = { 
    welcome: null, 
    stats: { aiRequests: 0 }, 
    rulesPosted: null, 
    supportPanelPosted: null
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
  }
};