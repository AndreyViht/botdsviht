const { Low, JSONFile } = require('lowdb');
const path = require('path');
const dbFile = path.join(__dirname, '..', '..', 'db.json');

const adapter = new JSONFile(dbFile);
const db = new Low(adapter);

// initialize default structure
(async () => {
  await db.read();
  db.data = db.data || { welcome: null, stats: { aiRequests: 0 } };
  await db.write();
})();

const wrapper = {
  get: (k) => db.data[k],
  set: (k, v) => { db.data[k] = v; return db.write(); },
  incrementAi: async () => { db.data.stats.aiRequests = (db.data.stats.aiRequests || 0) + 1; await db.write(); },
  getAll: () => db.data,
  // lowdb chain-like helper
  get: function(key) { return { value: db.data[key], write: async () => await db.write() }; }
};

module.exports = {
  // small convenience wrapper for above
  set: async (k, v) => { db.data[k] = v; try { await db.write(); } catch (e) { if (e.code !== 'EPERM') throw e; console.warn('DB write warning (EPERM):', e.message); } return db.data[k]; },
  get: (k) => db.data && db.data[k],
  incrementAi: async () => { 
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
  all: () => db.data
};
