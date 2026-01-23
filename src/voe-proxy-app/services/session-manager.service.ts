/**
 * Session Manager Service
 * Manages FlareSolverr sessions and cookies for efficient request handling
 */

import { Redis } from 'ioredis';
import axios, { AxiosInstance } from 'axios';
import Redlock, { Lock } from 'redlock';

interface SessionData {
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

interface FlareSolverrSession {
  status: string;
  message: string;
  session: string;
  sessions: string[];
}

interface FlareSolverrResponse {
  status: string;
  message: string;
  solution: {
    url: string;
    status: number;
    cookies: any[];
    userAgent: string;
    headers: Record<string, string>;
    response: string;
  };
  startTimestamp: number;
  endTimestamp: number;
}

export class SessionManager {
  private readonly redis: Redis;
  private readonly flaresolverr: AxiosInstance;
  private readonly redlock: Redlock;
  private readonly SESSION_KEY = 'voe:session';
  private readonly SESSION_TTL = 3600; // 1 hour
  private readonly LOCK_TTL = 30000; // 30 seconds lock timeout

  constructor(redisUrl: string, flaresolverrUrl: string) {
    this.redis = new Redis(redisUrl);

    // Initialize Redlock for distributed locking
    this.redlock = new Redlock([this.redis], {
      driftFactor: 0.01,
      retryCount: 10,
      retryDelay: 200,
      retryJitter: 200,
      automaticExtensionThreshold: 500,
    });

    // Redlock error handling
    this.redlock.on('error', (error) => {
      console.error('[Redlock] Error:', error);
    });

    this.flaresolverr = axios.create({
      baseURL: flaresolverrUrl,
      timeout: 65000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Get or create session for domain
   */
  async getSession(domain: string): Promise<SessionData | null> {
    const key = `${this.SESSION_KEY}:${domain}`;
    const data = await this.redis.get(key);

    if (!data) return null;

    const session: SessionData = JSON.parse(data);

    // Update last used timestamp
    session.lastUsedAt = Date.now();
    await this.redis.setex(key, this.SESSION_TTL, JSON.stringify(session));

    return session;
  }

  /**
   * Save session to Redis
   */
  async saveSession(domain: string, session: SessionData): Promise<void> {
    const key = `${this.SESSION_KEY}:${domain}`;
    await this.redis.setex(key, this.SESSION_TTL, JSON.stringify(session));
  }

  /**
   * Create new FlareSolverr session
   */
  async createFlareSolverrSession(): Promise<string> {
    console.log('[SessionManager] Creating new FlareSolverr session');

    const response = await this.flaresolverr.post<FlareSolverrSession>('', {
      cmd: 'sessions.create',
    });

    if (response.data.status !== 'ok') {
      throw new Error(`Failed to create session: ${response.data.message}`);
    }

    console.log(`[SessionManager] Created session: ${response.data.session}`);
    return response.data.session;
  }

  /**
   * Destroy FlareSolverr session
   */
  async destroyFlareSolverrSession(sessionId: string): Promise<void> {
    try {
      await this.flaresolverr.post('', {
        cmd: 'sessions.destroy',
        session: sessionId,
      });
      console.log(`[SessionManager] Destroyed session: ${sessionId}`);
    } catch (error) {
      console.error(
        `[SessionManager] Failed to destroy session ${sessionId}:`,
        error,
      );
    }
  }

  /**
   * Fetch URL through FlareSolverr with session
   */
  async fetchWithSession(
    url: string,
    sessionId: string,
    proxy?: string,
  ): Promise<FlareSolverrResponse> {
    const request: any = {
      cmd: 'request.get',
      url,
      session: sessionId,
      maxTimeout: 60000,
    };

    if (proxy) {
      request.proxy = { url: proxy };
    }

    const response = await this.flaresolverr.post<FlareSolverrResponse>(
      '',
      request,
    );

    if (response.data.status !== 'ok') {
      throw new Error(`FlareSolverr error: ${response.data.message}`);
    }

    return response.data;
  }

  /**
   * Acquire distributed lock for domain (prevents concurrent session updates across instances)
   */
  async acquireLock(domain: string): Promise<Lock> {
    const lockKey = `voe:lock:session:${domain}`;

    console.log(`[SessionManager] Acquiring lock for ${domain}`);

    try {
      const lock = await this.redlock.acquire([lockKey], this.LOCK_TTL);
      console.log(`[SessionManager] Lock acquired for ${domain}`);
      return lock;
    } catch (error) {
      console.error(
        `[SessionManager] Failed to acquire lock for ${domain}:`,
        error,
      );
      throw new Error(`Failed to acquire lock for ${domain}`);
    }
  }

  /**
   * Refresh session (go through FlareSolverr again)
   */
  async refreshSession(
    domain: string,
    url: string,
    proxy?: string,
  ): Promise<SessionData> {
    console.log(`[SessionManager] Refreshing session for ${domain}`);

    const lock = await this.acquireLock(domain);

    try {
      // Double-check if session was refreshed while waiting for lock
      const existingSession = await this.getSession(domain);
      if (existingSession && Date.now() - existingSession.createdAt < 5000) {
        console.log(
          `[SessionManager] Session already refreshed by another instance`,
        );
        return existingSession;
      }

      // Destroy old session if exists
      if (existingSession?.sessionId) {
        await this.destroyFlareSolverrSession(existingSession.sessionId);
      }

      // Create new session
      const sessionId = await this.createFlareSolverrSession();

      // Fetch URL with new session
      const response = await this.fetchWithSession(url, sessionId, proxy);

      // Save session data
      const sessionData: SessionData = {
        sessionId,
        cookies: response.solution.cookies,
        userAgent: response.solution.userAgent,
        createdAt: Date.now(),
        lastUsedAt: Date.now(),
      };

      await this.saveSession(domain, sessionData);

      console.log(`[SessionManager] Session refreshed for ${domain}`);
      return sessionData;
    } finally {
      await lock.release();
    }
  }

  /**
   * Get cookies for domain
   */
  async getCookies(domain: string): Promise<string> {
    const session = await this.getSession(domain);
    if (!session) return '';

    return session.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }

  /**
   * Get User-Agent for domain
   */
  async getUserAgent(domain: string): Promise<string> {
    const session = await this.getSession(domain);
    return session?.userAgent || 'Mozilla/5.0 (compatible)';
  }

  /**
   * Check if session is valid (not expired)
   */
  async isSessionValid(domain: string): Promise<boolean> {
    const session = await this.getSession(domain);
    if (!session) return false;

    const now = Date.now();
    const age = now - session.createdAt;

    // Session valid for 1 hour
    return age < this.SESSION_TTL * 1000;
  }

  /**
   * Close Redis connection and Redlock
   */
  async close(): Promise<void> {
    await this.redlock.quit();
    await this.redis.quit();
  }
}
