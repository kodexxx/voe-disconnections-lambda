/**
 * VOE Proxy App Configuration
 * Centralized configuration management
 */

export class VoeProxyAppConfig {
  // Server configuration
  static readonly PORT = parseInt(process.env.PORT || '3001', 10);
  static readonly HOST = process.env.HOST || '0.0.0.0';
  static readonly NODE_ENV = process.env.NODE_ENV || 'development';

  // Logging
  static readonly LOG_LEVEL = process.env.LOG_LEVEL || 'info';

  // Redis configuration
  static readonly REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

  // FlareSolverr configuration
  static readonly FLARESOLVERR_URL =
    process.env.FLARESOLVERR_URL || 'http://flaresolverr:8191/v1';

  // Proxy URLs (optional, comma-separated)
  static readonly VOE_PROXY_URL = process.env.VOE_PROXY_URL
    ? process.env.VOE_PROXY_URL.split(',').map((p) => p.trim())
    : [];

  // VOE specific
  static readonly VOE_INIT_URL =
    'https://www.voe.com.ua/disconnection/detailed';

  // Session pool settings
  static readonly SESSION_POOL_SIZE = 10;
  static readonly SESSION_TTL = 300000; // 5 minutes
  static readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute

  // Request timeouts
  static readonly REQUEST_TIMEOUT = 120000; // 2 minutes
  static readonly FLARESOLVERR_TIMEOUT = 65000; // 65 seconds
  static readonly DIRECT_REQUEST_TIMEOUT = 30000; // 30 seconds
}
