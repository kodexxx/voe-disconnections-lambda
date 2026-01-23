/**
 * VOE Proxy App - Fastify Application
 * Session pool proxy for VOE website with auto-refresh and metrics
 */

import Fastify, { FastifyInstance } from 'fastify';
import { VoeApiController } from './controllers/voe-api.controller';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
    requestTimeout: 120000, // 2 minutes
  });

  // Get configuration
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const flaresolverrUrl =
    process.env.FLARESOLVERR_URL || 'http://flaresolverr:8191/v1';
  const proxies = process.env.VOE_PROXY_URL
    ? process.env.VOE_PROXY_URL.split(',').map((p) => p.trim())
    : [];

  // Initialize controller
  const voeApiController = new VoeApiController(
    redisUrl,
    flaresolverrUrl,
    proxies,
  );

  // Initialize session pool on startup (async, non-blocking)
  app.addHook('onReady', async () => {
    app.log.info('Starting session pool initialization in background...');

    // Initialize pool in background (don't await - it takes 2-5 minutes)
    voeApiController
      .initialize()
      .then(() => {
        app.log.info('Session pool ready!');
      })
      .catch((error) => {
        app.log.error({ err: error }, 'Failed to initialize session pool');
      });
  });

  // Health check
  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  // VOE API endpoints
  app.get('/disconnections', async (request, reply) => {
    return voeApiController.getDisconnections(request as any, reply);
  });

  app.get('/autocomplete/city', async (request, reply) => {
    return voeApiController.autocompleteCity(request as any, reply);
  });

  app.get('/autocomplete/street', async (request, reply) => {
    return voeApiController.autocompleteStreet(request as any, reply);
  });

  app.get('/autocomplete/house', async (request, reply) => {
    return voeApiController.autocompleteHouse(request as any, reply);
  });

  // Pool stats
  app.get('/pool/stats', async (request, reply) => {
    return voeApiController.getPoolStats(request, reply);
  });

  // 404 handler
  app.setNotFoundHandler((_, reply) => {
    reply.code(404).send({
      error: 'Not Found',
      message: 'Route not found',
    });
  });

  // Error handler
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);

    reply.code(error.statusCode || 500).send({
      error: error.name || 'Internal Server Error',
      message: error.message,
    });
  });

  return app;
}
