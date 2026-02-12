/**
 * VOE API Controller
 * Handles specific VOE website requests
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { SessionPoolService } from '../services/session-pool.service';
import { parse as HTMLParse } from 'node-html-parser';
import querystring from 'querystring';
import { VoeDisconnectionValueItem } from '../../disconnections/interfaces/disconnections-item.interface';
import {
  VOE_CELL_DURATION_MS,
  VOE_HALF_CELL_DURATION_MS,
} from '../../voe-fetcher/voe-fetcher.constants';
import {
  getDateWithTzOffset,
  getUkraineUtcOffsetMinutes,
  mergeInterval,
} from '../../common/utils/date.util';
import { AutocompleteItem } from '../interfaces/autocomplete-item.interface';

export class VoeApiController {
  private readonly sessionPool: SessionPoolService;

  constructor(sessionPool: SessionPoolService) {
    this.sessionPool = sessionPool;
  }

  /**
   * Initialize session pool
   */
  async initialize(): Promise<void> {
    await this.sessionPool.initializePool();
  }

  /**
   * GET /disconnections?cityId=...&streetId=...&houseId=...
   */
  async getDisconnections(
    request: FastifyRequest<{
      Querystring: { cityId: string; streetId: string; houseId: string };
    }>,
    reply: FastifyReply,
  ) {
    const { cityId, streetId, houseId } = request.query;

    if (!cityId || !streetId || !houseId) {
      reply.code(400);
      return {
        error: 'Missing required parameters: cityId, streetId, houseId',
      };
    }

    try {
      const params = querystring.stringify({
        ajax_form: 1,
        _wrapper_format: 'drupal_ajax',
      });

      const url = `https://www.voe.com.ua/disconnection/detailed?${params}`;

      // Make POST request with form data via session pool
      const formData = new URLSearchParams({
        city_id: cityId,
        street_id: streetId,
        house_id: houseId,
        form_id: 'disconnection_detailed_search_form',
      });

      const { data, sessionId } = await this.sessionPool.fetchWithSession<any>(
        url,
        {
          method: 'POST',
          data: formData,
        },
      );

      const dataInsert = data?.find((v) => v.command === 'insert')?.data;

      if (!dataInsert) {
        throw new Error('No data');
      }

      const { intervals, queueName } = this.parse(dataInsert);

      return {
        success: true,
        sessionId,
        data: intervals,
        queueName,
      };
    } catch (error) {
      console.error('[VoeApi] getDisconnections failed:', error);
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * GET /autocomplete/city?q=...
   */
  async autocompleteCity(
    request: FastifyRequest<{ Querystring: { q: string } }>,
    reply: FastifyReply,
  ) {
    const { q } = request.query;

    if (!q) {
      reply.code(400);
      return { error: 'Missing required parameter: q' };
    }

    try {
      const params = querystring.stringify({ q });
      const url = `https://www.voe.com.ua/disconnection/detailed/autocomplete/read_city?${params}`;

      const { data, sessionId } =
        await this.sessionPool.fetchWithSession<any>(url);

      const cities: AutocompleteItem[] =
        data?.map((item: any) => {
          const root = HTMLParse(item.label);
          const id = root.querySelector('div')?.attributes['data-id'];
          return {
            id,
            name: item.value,
          };
        }) ?? [];

      return {
        success: true,
        sessionId,
        cities,
      };
    } catch (error) {
      console.error('[VoeApi] autocompleteCity failed:', error);
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * GET /autocomplete/street?cityId=...&q=...
   */
  async autocompleteStreet(
    request: FastifyRequest<{ Querystring: { cityId: string; q: string } }>,
    reply: FastifyReply,
  ) {
    const { cityId, q } = request.query;

    if (!cityId || !q) {
      reply.code(400);
      return { error: 'Missing required parameters: cityId, q' };
    }

    try {
      const params = querystring.stringify({ q });
      const url = `https://www.voe.com.ua/disconnection/detailed/autocomplete/read_street/${cityId}?${params}`;

      const { data, sessionId } =
        await this.sessionPool.fetchWithSession<any>(url);

      const streets: AutocompleteItem[] =
        data?.map((item: any) => {
          const root = HTMLParse(item.label);
          const id = root.querySelector('div')?.attributes['data-id'];
          return {
            id,
            name: item.value,
          };
        }) ?? [];

      return {
        success: true,
        sessionId,
        streets,
      };
    } catch (error) {
      console.error('[VoeApi] autocompleteStreet failed:', error);
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * GET /autocomplete/house?streetId=...&q=...
   */
  async autocompleteHouse(
    request: FastifyRequest<{ Querystring: { streetId: string; q: string } }>,
    reply: FastifyReply,
  ) {
    const { streetId, q } = request.query;

    if (!streetId || !q) {
      reply.code(400);
      return { error: 'Missing required parameters: streetId, q' };
    }

    try {
      const params = querystring.stringify({ q });
      const url = `https://www.voe.com.ua/disconnection/detailed/autocomplete/read_house/${streetId}?${params}`;

      const { data, sessionId } =
        await this.sessionPool.fetchWithSession<any>(url);

      const houses: AutocompleteItem[] =
        data?.map((item: any) => {
          const root = HTMLParse(item.label);
          const id = root.querySelector('div')?.attributes['data-id'];
          return {
            id,
            name: item.value,
          };
        }) ?? [];

      return {
        success: true,
        sessionId,
        houses,
      };
    } catch (error) {
      console.error('[VoeApi] autocompleteHouse failed:', error);
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * GET /pool/stats - Get session pool statistics
   */
  async getPoolStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const stats = await this.sessionPool.getPoolStats();
      return {
        success: true,
        ...stats,
      };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private parse(page: string): {
    intervals: VoeDisconnectionValueItem[];
    queueName: string;
  } {
    const root = HTMLParse(page);
    const table = root.querySelector('div.table_wrapper');
    const heads: string[] = [];
    const days = new Map<
      string,
      {
        possibility: string;
        time: string;
        duration: number;
      }[]
    >();
    const queueName = table
      .querySelector('div.disconnection-detailed-table > p')
      ?.textContent?.trim();
    const tableItems =
      table?.querySelectorAll(
        'div.disconnection-detailed-table-container > div',
      ) ?? [];

    let currentDay = undefined;
    let currentDayCount = 0;
    for (const item of tableItems) {
      // Parse hour headers (skip first "Часові проміжки")
      if (item.classList.contains('head')) {
        const headerText = item.text?.trim();
        if (headerText && headerText !== 'Часові проміжки') {
          // Convert "00-01" to "00:00"
          const timeMatch = headerText.match(/(\d{2})-\d{2}/);
          if (timeMatch) {
            heads.push(`${timeMatch[1]}:00`);
          }
        }
      }

      // Parse day legend (e.g., "чт 22.01")
      if (item.classList.contains('legend') && item.text) {
        days.set(item.text, []);
        console.log(days);
        currentDay = days.get(item.text);
        currentDayCount = 0;
      }

      // Parse cells with disconnection data
      if (currentDay && item.classList.contains('cell')) {
        const disconnected = item.classList.contains('has_disconnection');
        const isFullHour = item.classList.contains('full_hour');
        const hourBlock = item.querySelector('div.hour_block');

        // Check for half-hour disconnections (left/right classes on hour_block)
        if (hourBlock && !isFullHour) {
          const isFirstHalf = hourBlock.classList.contains('left');
          const isSecondHalf = hourBlock.classList.contains('right');

          if (isFirstHalf || isSecondHalf) {
            const possibility = item.classList.contains('confirm_1')
              ? '(точно)'
              : '(можливо)';

            currentDay.push({
              time: isFirstHalf
                ? heads[currentDayCount]
                : heads[currentDayCount]?.replace(/:00/, ':30'),
              possibility,
              duration: VOE_HALF_CELL_DURATION_MS,
            });
          }
        }

        // Full hour disconnection
        if (disconnected && isFullHour) {
          const possibility = item.classList.contains('confirm_1')
            ? '(точно)'
            : '(можливо)';
          currentDay.push({
            time: heads[currentDayCount],
            possibility,
            duration: VOE_CELL_DURATION_MS,
          });
        }

        currentDayCount++;
      }
    }

    const items = Object.entries(Object.fromEntries(days.entries())).flatMap(
      ([dayStr, times]) => {
        return times.map((time) => {
          const matches = dayStr.match(/.* (\d{2})\.(\d{2})/);
          const [, day, month] = matches ?? [];

          const timeMatches = time.time.match(/(\d{2}):(\d{2})/);
          const [, hour, minutes] = timeMatches ?? [];

          const currentYear = new Date().getFullYear();
          const from = getDateWithTzOffset(
            currentYear,
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minutes),
            getUkraineUtcOffsetMinutes(),
          );
          const to = new Date(from.getTime() + time.duration);

          return { from, to, possibility: time.possibility };
        });
      },
    );

    return { intervals: mergeInterval(items), queueName };
  }
}
