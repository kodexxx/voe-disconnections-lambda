/**
 * Session Pool Manager
 * Manages pool of FlareSolverr sessions with random selection and auto-refresh
 */

import { Redis } from 'ioredis';
import { AxiosInstance } from 'axios';
import Redlock from 'redlock';
import { SessionInfo } from '../interfaces/session-info.interface';
import { FlareSolverrResponse } from '../interfaces/flaresolverr-response.interface';
import { VoeProxyAppConfig } from '../voe-proxy-app.config';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';

export class SessionPoolService {
  private readonly redis: Redis;
  private readonly flaresolverr: AxiosInstance;
  private readonly redlock: Redlock;
  private readonly axiosClient: AxiosInstance;

  private readonly POOL_SIZE: number;
  private readonly SESSION_PREFIX = 'voe:pool:session';
  private readonly LOCK_PREFIX = 'voe:lock:session';
  private readonly LOCK_TTL = 60000; // 60 seconds (FlareSolverr can take 15-30s)
  private readonly SESSION_TTL: number;
  private readonly HEALTH_CHECK_INTERVAL: number;
  private readonly INIT_URL: string;
  private readonly proxies: string[];
  private isInitialized = false;
  private initializationProgress = 0;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(
    redis: Redis,
    flaresolverr: AxiosInstance,
    axiosClient: AxiosInstance,
    redlock: Redlock,
    initUrl: string,
    proxies: string[] = [],
  ) {
    this.INIT_URL = initUrl;
    this.redis = redis;
    this.flaresolverr = flaresolverr;
    this.axiosClient = axiosClient;
    this.redlock = redlock;
    this.proxies = proxies;
    this.POOL_SIZE = VoeProxyAppConfig.SESSION_POOL_SIZE;
    this.SESSION_TTL = VoeProxyAppConfig.SESSION_TTL;
    this.HEALTH_CHECK_INTERVAL = VoeProxyAppConfig.HEALTH_CHECK_INTERVAL;
  }

  /**
   * Initialize session pool (create 10 sessions)
   */
  async initializePool(): Promise<void> {
    console.log(
      `[SessionPool] Initializing pool of ${this.POOL_SIZE} sessions...`,
    );
    this.isInitialized = false;
    this.initializationProgress = 0;

    for (let i = 0; i < this.POOL_SIZE; i++) {
      try {
        const existSession = await this.getSession(i);
        if (existSession) {
          continue;
        }
        await this.createSession(i);
        this.initializationProgress = Math.round(
          ((i + 1) / this.POOL_SIZE) * 100,
        );
        console.log(
          `[SessionPool] Progress: ${this.initializationProgress}% (${i + 1}/${this.POOL_SIZE})`,
        );
      } catch (error) {
        console.error(`[SessionPool] Failed to create session ${i}:`, error);
      }
    }

    this.isInitialized = true;
    console.log(
      `[SessionPool] Pool initialized with ${this.POOL_SIZE} sessions`,
    );

    // Start health check loop
    this.startHealthCheckLoop();
  }

  /**
   * Create new session
   */
  private async createSession(index: number): Promise<SessionInfo> {
    const proxy =
      this.proxies.length > 0
        ? this.proxies[index % this.proxies.length]
        : undefined;

    // Initial request to get cookies
    const response = await this.fetchWithFlareSolverr(this.INIT_URL, proxy);

    const session: SessionInfo = {
      id: `session-${index}`,
      sessionId: Math.random().toString(),
      cookies: response.solution.cookies,
      userAgent: response.solution.userAgent,
      proxy,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      requestCount: 0,
      failCount: 0,
    };

    await this.saveSession(session);
    console.log(
      `[SessionPool] Created ${session.id} with proxy: ${proxy || 'none'}`,
    );

    return session;
  }

  /**
   * Get best available session from pool
   * Priority:
   * 1. Live sessions (not refreshing, created recently)
   * 2. Sessions that started refreshing (sorted by refresh start time)
   */
  async getBestSession(): Promise<SessionInfo | null> {
    const allSessions: SessionInfo[] = [];

    // Collect all sessions from pool
    for (let i = 0; i < this.POOL_SIZE; i++) {
      const session = await this.getSession(i);
      if (session) {
        allSessions.push(session);
      }
    }

    if (allSessions.length === 0) {
      return null;
    }

    // Separate live and refreshing sessions
    const liveSessions = allSessions.filter((s) => !s.refreshingAt);
    const refreshingSessions = allSessions
      .filter((s) => s.refreshingAt)
      .sort((a, b) => (a.refreshingAt || 0) - (b.refreshingAt || 0)); // Earliest refresh first

    // Prioritize live sessions
    if (liveSessions.length > 0) {
      // Filter out stale sessions (older than SESSION_TTL)
      const freshSessions = liveSessions.filter((s) => {
        const age = Date.now() - s.createdAt;
        return age < this.SESSION_TTL;
      });

      if (freshSessions.length > 0) {
        // Return random fresh session
        const randomIndex = Math.floor(Math.random() * freshSessions.length);
        return freshSessions[randomIndex];
      }

      // If no fresh sessions, return any live session (will be refreshed on first use)
      const randomIndex = Math.floor(Math.random() * liveSessions.length);
      return liveSessions[randomIndex];
    }

    // If no live sessions, return earliest refreshing session
    if (refreshingSessions.length > 0) {
      console.log(
        `[SessionPool] All sessions refreshing, using earliest: ${refreshingSessions[0].id}`,
      );
      return refreshingSessions[0];
    }

    return null;
  }

  /**
   * Get random session from pool (legacy - now uses getBestSession)
   */
  async getRandomSession(): Promise<SessionInfo | null> {
    return this.getBestSession();
  }

  async getSession(index: number) {
    const sessionKey = `${this.SESSION_PREFIX}:session-${index}`;

    const data = await this.redis.get(sessionKey);
    if (!data) return null;

    return JSON.parse(data);
  }

  /**
   * Save session to Redis
   */
  private async saveSession(session: SessionInfo): Promise<void> {
    const key = `${this.SESSION_PREFIX}:${session.id}`;
    await this.redis.set(key, JSON.stringify(session));
  }

  /**
   * Update session metrics
   */
  async updateSessionMetrics(
    sessionId: string,
    success: boolean,
  ): Promise<void> {
    const key = `${this.SESSION_PREFIX}:${sessionId}`;
    const data = await this.redis.get(key);

    if (!data) return;

    const session: SessionInfo = JSON.parse(data);
    session.lastUsedAt = Date.now();
    session.requestCount++;

    if (!success) {
      session.failCount++;
    }

    await this.saveSession(session);
  }

  /**
   * Refresh session (with distributed lock)
   */
  async refreshSession(sessionId: string): Promise<SessionInfo> {
    const lockKey = `${this.LOCK_PREFIX}:${sessionId}`;

    console.log(`[SessionPool] Acquiring lock to refresh ${sessionId}`);
    const lock = await this.redlock.acquire([lockKey], this.LOCK_TTL);

    try {
      // Double-check if already refreshed
      const key = `${this.SESSION_PREFIX}:${sessionId}`;
      const data = await this.redis.get(key);

      if (data) {
        const existing: SessionInfo = JSON.parse(data);

        // If currently refreshing, check if it's done
        if (existing.refreshingAt) {
          const refreshAge = Date.now() - existing.refreshingAt;

          // If refreshing started recently (< 10 seconds ago), assume it's done
          if (refreshAge < 10000 && !existing.refreshingAt) {
            console.log(
              `[SessionPool] ${sessionId} already refreshed by another instance`,
            );
            return existing;
          }
        }

        // If recently created (< 10 seconds ago), use existing
        const age = Date.now() - existing.createdAt;
        if (age < 10000) {
          console.log(
            `[SessionPool] ${sessionId} recently created, using existing`,
          );
          return existing;
        }

        // Mark session as refreshing
        existing.refreshingAt = Date.now();
        await this.saveSession(existing);

        // Log old session stats
        const lifetime = (Date.now() - existing.createdAt) / 1000;
        console.log(
          `[SessionPool] Session ${sessionId} died: ` +
            `lifetime=${lifetime.toFixed(0)}s, ` +
            `requests=${existing.requestCount}, ` +
            `fails=${existing.failCount}`,
        );
      }

      // Create new session
      const index = parseInt(sessionId.split('-')[1]);
      const newSession = await this.createSession(index);

      console.log(`[SessionPool] ${sessionId} refreshed successfully`);
      return newSession;
    } finally {
      await lock.release();
    }
  }

  /**
   * Get initialization status
   */
  getInitializationStatus(): { isInitialized: boolean; progress: number } {
    return {
      isInitialized: this.isInitialized,
      progress: this.initializationProgress,
    };
  }

  /**
   * Make HTTP request with session (tries fast path with cookies first)
   */
  async fetchWithSession<T>(
    url: string,
    options?: {
      method?: 'GET' | 'POST';
      data?: URLSearchParams;
    },
  ): Promise<{ data: T; sessionId: string }> {
    if (!this.isInitialized) {
      throw new Error(
        `Session pool is still initializing (${this.initializationProgress}%). Please wait...`,
      );
    }

    let session = await this.getRandomSession();
    console.log(session.sessionId);

    if (!session) {
      throw new Error('No sessions available in pool');
    }

    const cookies = session.cookies
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');

    const headers = {
      'User-Agent': session.userAgent,
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      Cookie: cookies,
      Referer: 'https://www.voe.com.ua/',
      Origin: 'https://www.voe.com.ua',
      'X-Requested-With': 'XMLHttpRequest',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    };

    try {
      console.log(
        `[SessionPool] Using ${session.id} for ${options?.method || 'GET'} ${url}`,
      );

      // Fast path: try with cookies (mimics browser request)
      const response =
        options?.method === 'POST'
          ? await this.axiosClient.post(url, options.data, {
              ...(session.proxy && {
                httpAgent: new HttpProxyAgent({
                  proxy: session.proxy,
                }),
                httpsAgent: new HttpsProxyAgent({
                  proxy: session.proxy,
                }),
              }),
              headers: {
                ...headers,
                'Content-Type':
                  'application/x-www-form-urlencoded; charset=UTF-8',
              },
              validateStatus: () => true,
            })
          : await this.axiosClient.get(url, {
              headers,
              validateStatus: () => true,
              ...(session.proxy && {
                httpAgent: new HttpProxyAgent({
                  proxy: session.proxy,
                }),
                httpsAgent: new HttpsProxyAgent({
                  proxy: session.proxy,
                }),
              }),
            });

      // Check if blocked by Cloudflare
      if (this.isCloudflareBlocked(response.data, response.status)) {
        console.log(
          `[SessionPool] ${session.id} blocked by Cloudflare, refreshing...`,
        );

        await this.updateSessionMetrics(session.id, false);

        // Refresh session to get new cookies
        session = await this.refreshSession(session.id);

        // Retry request with new cookies (NOT through FlareSolverr)
        const newCookies = session.cookies
          .map((c) => `${c.name}=${c.value}`)
          .join('; ');

        const retryResponse =
          options?.method === 'POST'
            ? await this.axiosClient.post(url, options.data, {
                headers: {
                  ...headers,
                  Cookie: newCookies,
                  'Content-Type':
                    'application/x-www-form-urlencoded; charset=UTF-8',
                },
                ...(session.proxy && {
                  httpAgent: new HttpProxyAgent({
                    proxy: session.proxy,
                  }),
                  httpsAgent: new HttpsProxyAgent({
                    proxy: session.proxy,
                  }),
                }),
                validateStatus: () => true,
              })
            : await this.axiosClient.get(url, {
                headers: {
                  ...headers,
                  Cookie: newCookies,
                },
                ...(session.proxy && {
                  httpAgent: new HttpProxyAgent({
                    proxy: session.proxy,
                  }),
                  httpsAgent: new HttpsProxyAgent({
                    proxy: session.proxy,
                  }),
                }),
                validateStatus: () => true,
              });

        await this.updateSessionMetrics(session.id, true);
        return {
          data: retryResponse.data as T,
          sessionId: session.id,
        };
      }

      await this.updateSessionMetrics(session.id, true);
      return {
        data: response.data as T,
        sessionId: session.id,
      };
    } catch (error) {
      console.error(`[SessionPool] Request failed with ${session.id}:`, error);
      await this.updateSessionMetrics(session.id, false);

      // Refresh session to get new cookies
      session = await this.refreshSession(session.id);

      // Retry request with new cookies (NOT through FlareSolverr)
      const newCookies = session.cookies
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');

      const retryResponse =
        options?.method === 'POST'
          ? await this.axiosClient.post(url, options.data, {
              headers: {
                ...headers,
                Cookie: newCookies,
                'Content-Type':
                  'application/x-www-form-urlencoded; charset=UTF-8',
              },
              ...(session.proxy && {
                httpAgent: new HttpProxyAgent({
                  proxy: session.proxy,
                }),
                httpsAgent: new HttpsProxyAgent({
                  proxy: session.proxy,
                }),
              }),
              validateStatus: () => true,
            })
          : await this.axiosClient.get(url, {
              headers: {
                ...headers,
                Cookie: newCookies,
              },
              ...(session.proxy && {
                httpAgent: new HttpProxyAgent({
                  proxy: session.proxy,
                }),
                httpsAgent: new HttpsProxyAgent({
                  proxy: session.proxy,
                }),
              }),
              validateStatus: () => true,
            });

      await this.updateSessionMetrics(session.id, true);
      return {
        data: retryResponse.data as T,
        sessionId: session.id,
      };
    }
  }

  /**
   * Check if Cloudflare blocked
   */
  private isCloudflareBlocked(html: string, status: number): boolean {
    if (status === 403 || status === 503) return true;
    if (html.includes('cf-browser-verification')) return true;
    if (html.includes('Just a moment...')) return true;
    if (html.includes('Checking your browser')) return true;
    return false;
  }

  /**
   * Create FlareSolverr session
   */
  private async createFlareSolverrSession(): Promise<string> {
    const response = await this.flaresolverr.post('', {
      cmd: 'sessions.create',
    });

    if (response.data.status !== 'ok') {
      throw new Error(`Failed to create session: ${response.data.message}`);
    }

    return response.data.session;
  }

  /**
   * Destroy FlareSolverr session
   */
  private async destroyFlareSolverrSession(sessionId: string): Promise<void> {
    try {
      await this.flaresolverr.post('', {
        cmd: 'sessions.destroy',
        session: sessionId,
      });
    } catch (error) {
      console.error(`Failed to destroy session ${sessionId}:`, error);
    }
  }

  /**
   * Fetch with FlareSolverr
   */
  private async fetchWithFlareSolverr(
    url: string,
    proxy?: string,
    postData?: string,
  ): Promise<FlareSolverrResponse> {
    const request: any = {
      cmd: postData ? 'request.post' : 'request.get',
      url,
      maxTimeout: 60000,
    };

    if (proxy) {
      const proxyUrl = new URL(proxy);
      request.proxy = {
        url: proxyUrl.origin,
        username: proxyUrl.username,
        password: proxyUrl.password,
      };
    }

    if (postData) {
      request.postData = postData;
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
   * Get pool statistics
   */
  async getPoolStats(): Promise<any> {
    const sessions = [];

    for (let i = 0; i < this.POOL_SIZE; i++) {
      const key = `${this.SESSION_PREFIX}:session-${i}`;
      const data = await this.redis.get(key);

      if (data) {
        const session: SessionInfo = JSON.parse(data);
        const lifetime = (Date.now() - session.createdAt) / 1000;
        const age = Date.now() - session.createdAt;
        const isStale = age > this.SESSION_TTL;
        const isRefreshing = !!session.refreshingAt;

        sessions.push({
          id: session.id,
          proxy: session.proxy || 'none',
          lifetime: `${lifetime.toFixed(0)}s`,
          requestCount: session.requestCount,
          failCount: session.failCount,
          lastUsed: new Date(session.lastUsedAt).toISOString(),
          status: isRefreshing ? 'refreshing' : isStale ? 'stale' : 'live',
          refreshingAt: session.refreshingAt
            ? new Date(session.refreshingAt).toISOString()
            : undefined,
          cookies: session.cookies,
        });
      }
    }

    return {
      isInitialized: this.isInitialized,
      initializationProgress: this.initializationProgress,
      poolSize: this.POOL_SIZE,
      activeSessions: sessions.length,
      sessions,
    };
  }

  /**
   * Check session health by making a test request
   */
  private async checkSessionHealth(session: SessionInfo): Promise<boolean> {
    try {
      const cookies = session.cookies
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');

      const response = await this.axiosClient.get(this.INIT_URL, {
        headers: {
          'User-Agent': session.userAgent,
          Cookie: cookies,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'uk-UA,uk;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        timeout: 10000,
        ...(session.proxy && {
          httpAgent: new HttpProxyAgent({
            proxy: session.proxy,
          }),
          httpsAgent: new HttpsProxyAgent({
            proxy: session.proxy,
          }),
        }),
        validateStatus: () => true,
      });

      // Check if blocked by Cloudflare
      if (this.isCloudflareBlocked(response.data, response.status)) {
        console.log(
          `[SessionPool] Health check failed for ${session.id}: Cloudflare blocked`,
        );
        return false;
      }

      console.log(
        `[SessionPool] Health check passed for ${session.id} (status: ${response.status})`,
      );
      return true;
    } catch (error) {
      console.log(
        `[SessionPool] Health check failed for ${session.id}:`,
        error.message,
      );
      return false;
    }
  }

  /**
   * Start health check loop (runs every minute)
   */
  private startHealthCheckLoop(): void {
    console.log(
      `[SessionPool] Starting health check loop (every ${this.HEALTH_CHECK_INTERVAL / 1000}s)`,
    );

    this.healthCheckInterval = setInterval(async () => {
      if (!this.isInitialized) {
        return;
      }

      console.log('[SessionPool] Running health checks...');

      for (let i = 0; i < this.POOL_SIZE; i++) {
        try {
          const session = await this.getSession(i);

          if (!session) {
            console.log(`[SessionPool] No session at index ${i}, skipping`);
            continue;
          }

          // Skip sessions that are currently refreshing
          if (session.refreshingAt) {
            const refreshAge = Date.now() - session.refreshingAt;
            if (refreshAge < 60000) {
              // Still refreshing (< 1 min)
              console.log(
                `[SessionPool] ${session.id} is refreshing, skipping health check`,
              );
              continue;
            }
          }

          // Check if session is healthy
          const isHealthy = await this.checkSessionHealth(session);

          if (!isHealthy) {
            console.log(
              `[SessionPool] ${session.id} is unhealthy, refreshing...`,
            );
            await this.refreshSession(session.id);
          }
        } catch (error) {
          console.error(
            `[SessionPool] Health check error for session ${i}:`,
            error,
          );
        }
      }

      console.log('[SessionPool] Health checks completed');
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    // Stop health check loop
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      console.log('[SessionPool] Health check loop stopped');
    }

    await this.redlock.quit();
    await this.redis.quit();
  }
}
