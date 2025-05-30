const swaggerJsdoc = require('swagger-jsdoc');
const pjson = require('../../package.json'); // To get app version

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Application API',
      version: pjson.version || '1.0.0',
      description: 'API documentation for the eCommerce and Course Platform',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3001}/api`, // Adjust if your API prefix is different
        description: 'Development server',
      },
      // You can add more servers here (e.g., staging, production)
    ],
    // Optional: Add components like securitySchemes for JWT/OAuth etc.
    // components: {
    //   securitySchemes: {
    //     bearerAuth: {
    //       type: 'http',
    //       scheme: 'bearer',
    //       bearerFormat: 'JWT',
    //     },
    //   },
    // },
    // security: [ // Global security definition (can be overridden at path/operation level)
    //   {
    //     bearerAuth: [],
    //   },
    // ],
  },
  // Path to the API docs (JSdoc comments)
  apis: ['./src/modules/**/*.routes.js', './src/app.js'], // Include app.js if you have global definitions there
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
