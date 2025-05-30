// server/src/config/environment.js
require('dotenv').config(); // Load .env file first as a fallback or for non-sensitive vars

// --- Hypothetical AWS SDK and Secrets Manager Client Setup ---
// In a real app, this would be more robust, possibly in its own module.
let secretsFromManager = null;
const AWS_SECRET_ID = process.env.AWS_SECRET_ID || 'myapp/secrets'; // Name of the secret in AWS Secrets Manager
const NODE_ENV = process.env.NODE_ENV || 'development';

// Async function to fetch secrets (conceptual)
async function fetchSecretsFromAWS() {
  if (NODE_ENV === 'test' || process.env.SKIP_AWS_SECRETS_MANAGER) { // Skip for tests or if explicitly told
    console.log('Skipping AWS Secrets Manager fetch.');
    return null;
  }
  try {
    // --- BEGIN HYPOTHETICAL SDK USAGE ---
    // const AWS = require('aws-sdk'); // Or specific client: const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
    // const secretsManagerClient = new AWS.SecretsManager({ region: process.env.AWS_REGION || 'us-east-1' });
    // const secretValue = await secretsManagerClient.getSecretValue({ SecretId: AWS_SECRET_ID }).promise();
    // // In SDK v3:
    // // const command = new GetSecretValueCommand({ SecretId: AWS_SECRET_ID });
    // // const secretValue = await secretsManagerClient.send(command);

    // if (secretValue.SecretString) {
    //   return JSON.parse(secretValue.SecretString);
    // }
    // console.warn(`AWS Secrets Manager: SecretString for ${AWS_SECRET_ID} is empty.`);
    // return null;
    // --- END HYPOTHETICAL SDK USAGE ---

    // For this conceptual illustration, let's simulate a fetch:
    if (process.env.SIMULATE_AWS_SECRET_FETCH_SUCCESS === 'true') {
      console.log(`[Conceptual] Successfully fetched secrets from AWS Secrets Manager for ${AWS_SECRET_ID}.`);
      return {
        JWT_SECRET: 'aws_jwt_secret_example',
        DB_PASSWORD: 'aws_db_password_example',
        DEFAULT_STUDENT_ROLE_ID: 'aws_default_student_role_id_example',
        // Other secrets like API keys etc.
      };
    } else {
      console.warn(`[Conceptual] AWS Secrets Manager: Not configured for actual fetch or SIMULATE_AWS_SECRET_FETCH_SUCCESS is not 'true'.`);
      return null;
    }
  } catch (error) {
    console.error(`Error fetching secrets from AWS Secrets Manager for ${AWS_SECRET_ID}:`, error.message);
    if (NODE_ENV === 'production') {
      // In production, if fetching fails, it might be a critical issue.
      // Depending on the secret, you might want to throw the error and halt startup.
      // For now, we'll allow fallback to .env/environment variables.
      // throw error;
    }
    return null;
  }
}

// --- Main Configuration Object ---
// We need an async function to initialize environment because fetching secrets is async.
async function initializeEnvironment() {
  secretsFromManager = await fetchSecretsFromAWS();

  const environment = {
    nodeEnv: NODE_ENV,
    port: process.env.PORT || 3001,

    // Secrets: Prefer Secrets Manager, then .env/process.env, then defaults
    jwtSecret: secretsFromManager?.JWT_SECRET || process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',

    db: {
      user: process.env.DB_USER, // Typically not highly secret, can be env var
      host: process.env.DB_HOST, // Typically not highly secret, can be env var
      database: process.env.DB_NAME, // Typically not highly secret, can be env var
      password: secretsFromManager?.DB_PASSWORD || process.env.DB_PASSWORD, // Highly secret
      port: process.env.DB_PORT || 5432,
    },

    defaultStudentRoleId: secretsFromManager?.DEFAULT_STUDENT_ROLE_ID ||
                          process.env.DEFAULT_STUDENT_ROLE_ID ||
                          'a1b2c3d4-e5f6-7890-1234-567890abcdef', // Default fallback

    // Sentry DSN might also come from Secrets Manager or directly from env var
    sentryDsn: secretsFromManager?.SENTRY_DSN_SERVER || process.env.SENTRY_DSN_SERVER,

    // Other configurations
    awsSecretId: AWS_SECRET_ID, // For reference or other uses
  };

  // --- Critical Configuration Checks ---
  if (!environment.jwtSecret) {
    console.error("FATAL ERROR: JWT_SECRET is not defined. Set it via AWS Secrets Manager or .env file.");
    process.exit(1);
  }
  if (!environment.db.password) {
    // DB password might be optional for some local setups if user doesn't require password,
    // but generally it's needed.
    console.warn("WARNING: DB_PASSWORD is not defined. Set it via AWS Secrets Manager or .env file.");
  }
  if (!environment.db.user || !environment.db.host || !environment.db.database) {
      console.warn("WARNING: Some database connection details (user, host, name) are missing. Ensure DB_USER, DB_HOST, DB_NAME are set in .env");
  }

  return environment;
}

// Export a promise that resolves with the environment configuration.
// The main application (server.js) will need to await this.
module.exports = initializeEnvironment();
