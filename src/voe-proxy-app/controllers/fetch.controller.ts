/**
 * Fetch Controller
 * Handles HTTP requests with intelligent session management and caching
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { SmartFetcherService } from '../services/smart-fetcher.service';
import {
  FetchRequest,
  FetchResponse,
  HealthResponse,
} from '../interfaces/fetch-request.interface';

export class FetchController {
  private readonly smartFetcher: SmartFetcherService;

  constructor(redisUrl: string, flaresolverrUrl: string) {
    this.smartFetcher = new SmartFetcherService(redisUrl, flaresolverrUrl);
  }

  /**
   * POST /fetch - Intelligent fetch with session caching
   */
  async fetch(
    request: FastifyRequest<{ Body: FetchRequest }>,
    reply: FastifyReply,
  ): Promise<FetchResponse> {
    const { url, proxy } = request.body;

    if (!url) {
      reply.code(400);
      return {
        success: false,
        error: 'URL is required',
      };
    }

    const startTime = Date.now();

    try {
      const html = await this.smartFetcher.fetch(url, proxy);
      const duration = Date.now() - startTime;

      return {
        success: true,
        html,
        duration,
        url,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      console.error('[FetchController] Fetch failed:', error);

      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        url,
      };
    }
  }

  /**
   * GET /health - Health check
   */
  async health(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<HealthResponse> {
    const response: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      flaresolverr: {
        available: true,
      },
    };

    return response;
  }

  /**
   * GET /session/:domain - Get session info for domain
   */
  async getSession(
    request: FastifyRequest<{ Params: { domain: string } }>,
    reply: FastifyReply,
  ) {
    const { domain } = request.params;

    try {
      const sessionInfo = await this.smartFetcher.getSessionInfo(domain);
      return sessionInfo;
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * DELETE /session/:domain - Clear session for domain
   */
  async clearSession(
    request: FastifyRequest<{ Params: { domain: string } }>,
    reply: FastifyReply,
  ) {
    const { domain } = request.params;

    try {
      await this.smartFetcher.clearSession(domain);
      return {
        success: true,
        message: `Session cleared for ${domain}`,
      };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
