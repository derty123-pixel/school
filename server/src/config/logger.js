const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }), // Log the full stack trace
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'your-service-name' }, // Replace with actual service name
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // Optional: colorize console output
        winston.format.simple() // For console, simple format might be more readable than JSON
                               // If JSON is preferred for console too, remove this line.
                               // Or use: winston.format.json()
      )
    })
    //
    // - Write all logs with importance level of `error` or less to `error.log`
    // - Write all logs with importance level of `info` or less to `combined.log`
    //
    // new winston.transports.File({ filename: 'error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// If not in production, log to the console with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
if (process.env.NODE_ENV !== 'production') {
  logger.remove(winston.transports.Console); // Remove existing console transport
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message} ${info.stack || ''}`)
    )
  }));
} else {
    // In production, ensure console output is JSON for Docker to capture structured logs
    logger.remove(winston.transports.Console);
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
        ),
    }));
}


// A stream object with a 'write' function that will be used by Morgan
logger.stream = {
  write: function(message, encoding) {
    // use the 'info' log level so the output will be picked up by both transports
    logger.info(message.trim());
  },
};

module.exports = logger;
