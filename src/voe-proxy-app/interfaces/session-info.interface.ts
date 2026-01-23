/**
 * Session information stored in Redis
 */
export interface SessionInfo {
  id: string;
  sessionId: string; // FlareSolverr session ID
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
  }>;
  userAgent: string;
  proxy?: string;
  createdAt: number;
  lastUsedAt: number;
  requestCount: number;
  failCount: number;
  refreshingAt?: number; // Timestamp when session started refreshing
}
