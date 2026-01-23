/**
 * Smart Fetcher Service
 * Intelligent HTTP client that automatically uses cached sessions or FlareSolverr
 */

import axios, { AxiosInstance } from 'axios';
import { SessionManager } from './session-manager.service';

export class SmartFetcherService {
  private readonly sessionManager: SessionManager;
  private readonly directClient: AxiosInstance;

  constructor(redisUrl: string, flaresolverrUrl: string) {
    this.sessionManager = new SessionManager(redisUrl, flaresolverrUrl);

    // Direct HTTP client (for requests with cached cookies)
    this.directClient = axios.create({
      timeout: 30000,
      validateStatus: () => true, // Don't throw on any status
    });
  }

  /**
   * Fetch URL - automatically uses cached session or FlareSolverr
   */
  async fetch(url: string, proxy?: string): Promise<string> {
    const domain = this.extractDomain(url);
    const startTime = Date.now();

    console.log(`[SmartFetcher] Fetching: ${url}`);

    // Try with cached session first
    const cachedHtml = await this.tryWithCachedSession(url, domain);
    if (cachedHtml) {
      const duration = Date.now() - startTime;
      console.log(
        `[SmartFetcher] ✓ Success with cached session in ${duration}ms`,
      );
      return cachedHtml;
    }

    // Fallback to FlareSolverr (refresh session)
    console.log(`[SmartFetcher] Cached session failed, using FlareSolverr`);
    const session = await this.sessionManager.refreshSession(
      domain,
      url,
      proxy,
    );

    const duration = Date.now() - startTime;
    console.log(`[SmartFetcher] ✓ Success with FlareSolverr in ${duration}ms`);

    // Parse HTML from session response
    const response = await this.sessionManager.fetchWithSession(
      url,
      session.sessionId,
      proxy,
    );
    return response.solution.response;
  }

  /**
   * Try to fetch with cached cookies (fast path)
   */
  private async tryWithCachedSession(
    url: string,
    domain: string,
  ): Promise<string | null> {
    // Check if session exists and valid
    const isValid = await this.sessionManager.isSessionValid(domain);
    if (!isValid) {
      console.log(`[SmartFetcher] No valid cached session for ${domain}`);
      return null;
    }

    // Get cached cookies and user-agent
    const cookies = await this.sessionManager.getCookies(domain);
    const userAgent = await this.sessionManager.getUserAgent(domain);

    if (!cookies) {
      console.log(`[SmartFetcher] No cookies for ${domain}`);
      return null;
    }

    try {
      // Make request with cached cookies
      const response = await this.directClient.get(url, {
        headers: {
          'User-Agent': userAgent,
          Cookie: cookies,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      // Check if response is valid (not blocked by Cloudflare)
      if (this.isCloudflareBlocked(response.data, response.status)) {
        console.log(`[SmartFetcher] Cloudflare blocked, cookies expired`);
        return null;
      }

      console.log(
        `[SmartFetcher] Cached cookies worked! Status: ${response.status}`,
      );
      return response.data;
    } catch (error) {
      console.error(`[SmartFetcher] Cached request failed:`, error);
      return null;
    }
  }

  /**
   * Check if response is blocked by Cloudflare
   */
  private isCloudflareBlocked(html: string, status: number): boolean {
    // Cloudflare challenge page detection
    if (status === 403 || status === 503) return true;
    if (html.includes('cf-browser-verification')) return true;
    if (html.includes('cloudflare')) return true;
    if (html.includes('Just a moment...')) return true;
    if (html.includes('Checking your browser')) return true;

    return false;
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get session info for domain
   */
  async getSessionInfo(domain: string): Promise<any> {
    const session = await this.sessionManager.getSession(domain);
    return {
      exists: !!session,
      createdAt: session?.createdAt,
      lastUsedAt: session?.lastUsedAt,
      cookiesCount: session?.cookies.length || 0,
    };
  }

  /**
   * Clear session for domain
   */
  async clearSession(domain: string): Promise<void> {
    const session = await this.sessionManager.getSession(domain);
    if (session?.sessionId) {
      await this.sessionManager.destroyFlareSolverrSession(session.sessionId);
    }
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.sessionManager.close();
  }
}
