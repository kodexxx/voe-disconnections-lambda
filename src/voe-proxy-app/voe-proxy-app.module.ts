/**
 * VOE Proxy App Module
 * Module factory with dependency injection
 */

import { Redis } from 'ioredis';
import axios from 'axios';
import Redlock from 'redlock';
import { VoeProxyAppConfig } from './voe-proxy-app.config';
import { SessionPoolService } from './services/session-pool.service';
import { VoeApiController } from './controllers/voe-api.controller';

// Single instance cache (no need for createCachedModule pattern in non-Lambda environment)
let moduleInstance: ReturnType<typeof createModule> | null = null;

function createModule() {
  // Redis client (shared across all services)
  const redis = new Redis(VoeProxyAppConfig.REDIS_URL);

  // Redlock for distributed locking (shared across all services)
  const redlock = new Redlock([redis], {
    driftFactor: 0.01,
    retryCount: 10,
    retryDelay: 200,
    retryJitter: 200,
    automaticExtensionThreshold: 30000,
  });

  redlock.on('error', (error) => {
    console.error('[Redlock] Error:', error);
  });

  // FlareSolverr HTTP client
  const flaresolverrClient = axios.create({
    baseURL: VoeProxyAppConfig.FLARESOLVERR_URL,
    timeout: VoeProxyAppConfig.FLARESOLVERR_TIMEOUT,
    headers: { 'Content-Type': 'application/json' },
  });

  // Direct HTTP client (for requests with cached cookies)
  const directHttpClient = axios.create({
    timeout: VoeProxyAppConfig.DIRECT_REQUEST_TIMEOUT,
    validateStatus: () => true,
  });

  // Session Pool Service (main service for VOE API)
  const sessionPoolService = new SessionPoolService(
    redis,
    flaresolverrClient,
    directHttpClient,
    redlock,
    VoeProxyAppConfig.VOE_INIT_URL,
    VoeProxyAppConfig.VOE_PROXY_URL,
  );

  // VOE API Controller
  const voeApiController = new VoeApiController(sessionPoolService);

  return {
    redis,
    redlock,
    sessionPoolService,
    voeApiController,
  };
}

/**
 * Get VOE Proxy App Module (singleton pattern)
 */
export function getVoeProxyAppModule() {
  if (!moduleInstance) {
    moduleInstance = createModule();
  }
  return moduleInstance;
}
