import { VoeDisconnectionValueItem } from '../disconnections/interfaces/disconnections-item.interface';
import { parse as HTMLParse } from 'node-html-parser';
import {
  getDateWithTzOffset,
  getUkraineUtcOffsetMinutes,
  mergeInterval,
} from '../common/utils/date.util';
import { VOE_CELL_DURATION_MS } from './voe-fetcher.constants';
import querystring from 'querystring';

export class VoeFetcherService {
  async getDisconnections(
    cityId: string,
    streetId: string,
    houseId: string,
  ): Promise<VoeDisconnectionValueItem[]> {
    const response = await this.getDetailedDisconnection(
      cityId,
      streetId,
      houseId,
    );
    const data = response?.find((v) => v.command === 'insert')?.data;
    if (!data) {
      throw new Error('No data');
    }
    return this.parse(data);
  }

  private async parse(page: string): Promise<VoeDisconnectionValueItem[]> {
    const root = HTMLParse(page);
    const table = root.querySelector('div.table_wrapper');
    const heads = [];
    const days = new Map<
      string,
      {
        possibility: string;
        time: string;
      }[]
    >();
    const tableItems =
      table?.querySelectorAll(
        'div.disconnection-detailed-table-container > div',
      ) ?? [];

    let currentDay = undefined;
    let currentDayCount = 0;
    for (const item of tableItems) {
      if (item.classList.contains('head')) {
        heads.push(item.text);
      }
      if (item.classList.contains('legend') && item.text) {
        days.set(item.text, []);
        currentDay = days.get(item.text);
        currentDayCount = 0;
      }

      if (currentDay && item.classList.contains('cell')) {
        const disconnected = item.classList.contains('has_disconnection');
        if (disconnected) {
          const possibility = item
            .querySelector('div')
            ?.classList.contains('disconnection_confirm_1')
            ? '(точно)'
            : '(можливо)';
          currentDay.push({
            time: heads[currentDayCount],
            possibility,
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
          const to = new Date(from.getTime() + VOE_CELL_DURATION_MS);

          return { from, to, possibility: time.possibility };
        });
      },
    );

    return mergeInterval(items);
  }

  private async getDetailedDisconnection(
    cityId: string,
    streetId: string,
    houseId: string,
  ) {
    const params = querystring.stringify({
      ajax_form: 1,
      _wrapper_format: 'drupal_ajax',
    });
    const response = await fetch(
      `https://www.voe.com.ua/disconnection/detailed?${params}`,
      {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
        method: 'POST',
        body: new URLSearchParams({
          city_id: cityId,
          street_id: streetId,
          house_id: houseId,
          form_id: 'disconnection_detailed_search_form',
        }),
      },
    );
    return response.json();
  }
}
