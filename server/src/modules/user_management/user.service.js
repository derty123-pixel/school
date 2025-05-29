// server/src/modules/user_management/user.service.js
const db = require('../../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const environment = require('../../config/environment');
const { v4: uuidv4 } = require('uuid'); // To generate UUIDs if needed, though DB should handle it

class UserService {
  async registerUser({ firstName, lastName, email, password }) {
    // 1. Check if user already exists
    const existingUser = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      throw { statusCode: 409, message: 'User already exists with this email.' };
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Insert new user
    // Ensure your phase1_schema.sql uses uuid_generate_v4() for user id default
    const newUserResult = await db.query(
      'INSERT INTO users (first_name, last_name, email, hashed_password) VALUES ($1, $2, $3, $4) RETURNING id, first_name, last_name, email, created_at, is_active',
      [firstName, lastName, email, hashedPassword]
    );
    const newUser = newUserResult.rows[0];

    // 4. Assign default role (e.g., 'student')
    // For MVP, using the hardcoded defaultStudentRoleId from environment.js
    // Ensure this role ID exists in your 'roles' table.
    const defaultRoleId = environment.defaultStudentRoleId; 
    if (!defaultRoleId) {
        console.warn("Warning: DEFAULT_STUDENT_ROLE_ID not set or role does not exist. User will not have a default role.");
    } else {
        try {
            // Verify role exists (optional, but good practice)
            const roleExists = await db.query('SELECT id FROM roles WHERE id = $1', [defaultRoleId]);
            if (roleExists.rows.length === 0) {
                console.warn(`Warning: Default role ID ${defaultRoleId} not found in roles table.`);
            } else {
                 await db.query('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [newUser.id, defaultRoleId]);
            }
        } catch (roleError) {
            console.error("Error assigning default role:", roleError);
            // Decide if this should throw an error or just log
        }
    }
    
    // Fetch roles to include in the response (or for the token later)
    const rolesResult = await db.query(
        `SELECT r.role_name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = $1`,
        [newUser.id]
    );
    newUser.roles = rolesResult.rows.map(r => r.role_name);


    return newUser;
  }

  async loginUser({ email, password }) {
    const { rows } = await db.query(
        `SELECT u.id, u.email, u.hashed_password, u.first_name, u.last_name, u.is_active,
                ARRAY_AGG(r.role_name) as roles
         FROM users u
         LEFT JOIN user_roles ur ON u.id = ur.user_id
         LEFT JOIN roles r ON ur.role_id = r.id
         WHERE u.email = $1
         GROUP BY u.id`,
        [email]
    );

    if (rows.length === 0) {
      throw { statusCode: 401, message: 'Invalid credentials.' };
    }

    const user = rows[0];

    if (!user.is_active) {
        throw { statusCode: 403, message: 'User account is inactive.' };
    }

    const isMatch = await bcrypt.compare(password, user.hashed_password);
    if (!isMatch) {
      throw { statusCode: 401, message: 'Invalid credentials.' };
    }

    // Update last_login_at
    try {
        await db.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    } catch (loginTimeError) {
        console.error("Error updating last_login_at:", loginTimeError);
    }

    const payload = {
      userId: user.id,
      email: user.email,
      roles: user.roles || [], // Ensure roles is an array
    };

    const token = jwt.sign(payload, environment.jwtSecret, {
      expiresIn: environment.jwtExpiresIn,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        roles: user.roles || [],
      },
    };
  }

  async getUserProfile(userId) {
    const userQuery = `
        SELECT u.id, u.first_name, u.last_name, u.email, u.profile_picture_url, u.is_active, u.last_login_at, u.created_at, u.updated_at,
               ARRAY_AGG(r.role_name) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id;
      `;
    const { rows } = await db.query(userQuery, [userId]);

    if (rows.length === 0) {
      throw { statusCode: 404, message: 'User not found.' };
    }
    return rows[0];
  }
}

module.exports = new UserService();
