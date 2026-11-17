const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

async function backup() {
  await mongoose.connect('mongodb://127.0.0.1:27017/campuskart');
  const db = mongoose.connection.db;

  const backupDir = path.join(__dirname, 'backup_db');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const collections = await db.listCollections().toArray();
  console.log(`Found ${collections.length} collections to back up:`, collections.map(c => c.name));

  const stats = {};
  for (const col of collections) {
    const name = col.name;
    const docs = await db.collection(name).find({}).toArray();
    const filePath = path.join(backupDir, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
    stats[name] = docs.length;
    console.log(`✓ Backed up collection "${name}": ${docs.length} documents -> ${filePath}`);
  }

  console.log('\nBackup completed successfully:', stats);
  await mongoose.disconnect();
}

backup().catch(err => {
  console.error('Backup error:', err);
  process.exit(1);
});
