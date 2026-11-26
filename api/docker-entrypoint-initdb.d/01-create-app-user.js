// Runs once, on an empty data directory. Creates a least-privilege application
// user so the API never connects as root.
const db = db.getSiblingDB(process.env.MONGO_INITDB_DATABASE || 'app');

db.createUser({
  user: process.env.MONGO_APP_USER || 'app',
  pwd: process.env.MONGO_APP_PASSWORD || 'change-me',
  roles: [{ role: 'readWrite', db: process.env.MONGO_INITDB_DATABASE || 'app' }],
});
