// server/src/config/environment.js
require('dotenv').config();

const environment = {
  port: process.env.PORT || 3001, // Default port for the server
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  db: {
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
  },
  // Default student role ID - ideally fetched or configured elsewhere
  // For MVP, ensure this role exists in your 'roles' table with this UUID
  // You can generate a UUID using `uuid_generate_v4()` in psql
  // Example: INSERT INTO roles (id, role_name, description) VALUES ('your-uuid-here', 'student', 'Default student role');
  defaultStudentRoleId: process.env.DEFAULT_STUDENT_ROLE_ID || 'a1b2c3d4-e5f6-7890-1234-567890abcdef', // REPLACE WITH ACTUAL VALID UUID from DB
};

if (!environment.jwtSecret) {
  console.error("FATAL ERROR: JWT_SECRET is not defined. Set it in your .env file.");
  process.exit(1);
}
if (!environment.db.user || !environment.db.host || !environment.db.database || !environment.db.password) {
    console.warn("WARNING: Some database connection details are missing. Ensure DB_USER, DB_HOST, DB_NAME, DB_PASSWORD are set in .env");
}


module.exports = environment;
