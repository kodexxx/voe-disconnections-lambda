/**
 * Session data for SessionManager
 */
export interface SessionData {
  sessionId: string;
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires?: number;
  }>;
  userAgent: string;
  createdAt: number;
  lastUsedAt: number;
}
