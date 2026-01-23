/**
 * Request interface for VOE proxy fetch
 */
export interface FetchRequest {
  url: string;
  proxy?: string;
  timeout?: number;
}

/**
 * Response interface for VOE proxy fetch
 */
export interface FetchResponse {
  success: boolean;
  html?: string;
  error?: string;
  duration?: number;
  url?: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  flaresolverr: {
    available: boolean;
    version?: string;
  };
}
