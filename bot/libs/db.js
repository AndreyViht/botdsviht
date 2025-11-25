const path = require('path');
let db = null;

// Initialize lowdb async
async function initDb() {
  if (db) return db;
  const { Low, JSONFile } = await import('lowdb');
  const dbFile = path.join(__dirname, '..', '..', 'db.json');
  const adapter = new JSONFile(dbFile);
  db = new Low(adapter);
  await db.read();
  db.data = db.data || { welcome: null, stats: { aiRequests: 0 } };
  await db.write();
  return db;
}

// Initialize on module load
let dbReady = initDb().catch(e => console.error('DB init error:', e));

module.exports = {
  set: async (k, v) => { 
    await dbReady;
    db.data[k] = v; 
    try { 
      await db.write(); 
    } catch (e) { 
      if (e.code !== 'EPERM') throw e; 
      console.warn('DB write warning (EPERM):', e.message); 
    } 
    return db.data[k]; 
  },
  get: (k) => db && db.data ? db.data[k] : null,
  incrementAi: async () => { 
    await dbReady;
    try {
      db.data.stats.aiRequests = (db.data.stats.aiRequests || 0) + 1; 
      await db.write(); 
    } catch (e) { 
      if (e.code === 'EPERM') {
        console.warn('DB write warning (file locked): incrementAi not persisted this time');
      } else {
        throw e;
      }
    }
  },
  all: () => db && db.data ? db.data : null
};
