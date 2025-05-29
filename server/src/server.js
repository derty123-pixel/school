// server/src/server.js
const app = require('./app');
const environment = require('./config/environment');
const db = require('./config/database'); // To initialize pool & test connection

const PORT = environment.port || 3001;

const startServer = async () => {
  try {
    // Test database connection (optional, but good for startup check)
    const client = await db.pool.connect();
    console.log('Successfully connected to the database for a quick test.');
    client.release();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Access API at http://localhost:${PORT}/api`);
      // Log important environment settings (be careful with secrets in production logs)
      console.log(`JWT Token Expires In: ${environment.jwtExpiresIn}`);
      if(process.env.NODE_ENV !== 'production') {
        console.log(`Default Student Role ID (for MVP): ${environment.defaultStudentRoleId}`);
      }
    });
  } catch (error) {
    console.error('Failed to start the server or connect to the database:', error);
    process.exit(1);
  }
};

startServer();
