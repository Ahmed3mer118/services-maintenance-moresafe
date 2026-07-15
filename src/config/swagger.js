import swaggerJsdoc from 'swagger-jsdoc';

const isVercel = !!process.env.VERCEL;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ERP Maintenance Management API',
      version: '1.0.0',
      description: 'Enterprise Maintenance Management Module REST API',
    },
    servers: [{ url: '/api/v1', description: 'API v1' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.js', './src/controllers/*.js'],
};

export const swaggerSpec = isVercel ? {} : swaggerJsdoc(options);
export default swaggerSpec;
