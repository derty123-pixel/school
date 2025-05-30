// server/src/server.js
const Sentry = require('@sentry/node');
const { ProfilingIntegration } = require('@sentry/profiling-node');
const environmentPromise = require('./config/environment'); // Now a promise
const logger = require('./config/logger'); // Using our winston logger

async function main() {
  try {
    const environment = await environmentPromise; // Resolve the environment configuration
    logger.info('Environment configuration loaded.');

    // Assuming package.json is in the parent directory relative to src/server.js
    let appVersion = '1.0.0'; // Default version
    try {
      const pjson = require('../package.json');
      appVersion = pjson.version || appVersion;
    } catch (e) {
      logger.warn('Could not load package.json for version info in server.js', e);
    }

    // Initialize Sentry as early as possible, now that environment is loaded
    if (environment.sentryDsn && environment.sentryDsn !== 'SENTRY_DSN_PLACEHOLDER_BACKEND') {
      Sentry.init({
        dsn: environment.sentryDsn,
        integrations: [
          new Sentry.Integrations.Http({ tracing: true }),
          new ProfilingIntegration(),
        ],
        tracesSampleRate: 1.0,
        profilesSampleRate: 1.0,
        environment: environment.nodeEnv || 'development',
        release: `server@${appVersion}`,
      });
      logger.info(`Sentry initialized for backend. Release: server@${appVersion}`);
    } else {
      logger.warn('Sentry DSN not found or is placeholder. Sentry not initialized.');
    }

    // Require app and db after environment and Sentry are set up
    const app = require('./app'); 
    const db = require('./config/database'); 

    const PORT = environment.port || 3001;

    // Test database connection (optional, but good for startup check)
    // Ensure db configuration is also using the resolved `environment` object if it depends on it.
    // For now, assuming db.js initializes its pool using process.env or the already modified environment.js
    const client = await db.pool.connect();
    logger.info('Successfully connected to the database for a quick test.');
    client.release();

    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Access API at http://localhost:${PORT}/api`);
      logger.info(`JWT Token Expires In: ${environment.jwtExpiresIn}`);
      if (environment.nodeEnv !== 'production') {
        logger.info(`Default Student Role ID (for MVP): ${environment.defaultStudentRoleId}`);
      }
    });

  } catch (error) {
    logger.error('Failed to initialize or start the server:', { error: error.message, stack: error.stack });
    // Capture with Sentry if it was initialized, otherwise it won't do anything.
    // Sentry.captureException should ideally be called only if Sentry is active.
    if (Sentry.getCurrentHub().getClient()) {
        Sentry.captureException(error);
    }
    process.exit(1);
  }
}

main();
