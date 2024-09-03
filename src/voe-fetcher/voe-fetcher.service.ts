import axios from 'axios';
import { VoeDisconnectionValueItem } from '../disconnections/interfaces/disconnections-item.interface';
import { parse as HTMLParse } from 'node-html-parser';
import { getDateWithTzOffset } from '../common/utils/date.util';
import {
  UKRAINE_TZ_OFFSET_MINUTES,
  VOE_CELL_DURATION_MS,
} from './voe-fetcher.constants';

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
    const data = response?.find(v => v.command === 'insert')?.data;
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
            UKRAINE_TZ_OFFSET_MINUTES,
          );
          const to = new Date(from.getTime() + VOE_CELL_DURATION_MS);

          return { from, to, possibility: time.possibility };
        });
      },
    );

    if (!items.length) {
      return [];
    }
    const mergedIntervals = [items[0]];

    for (let i = 1; i < items.length; i++) {
      const current = items[i];
      const lastMerged = mergedIntervals[mergedIntervals.length - 1];

      if (
        current.from.getTime() === lastMerged.to.getTime() &&
        current.possibility === lastMerged.possibility
      ) {
        lastMerged.to = current.to;
      } else {
        mergedIntervals.push(current);
      }
    }

    return mergedIntervals;
  }

  private async getDetailedDisconnection(
    cityId: string,
    streetId: string,
    houseId: string,
  ) {
    const data = await axios.post(
      'https://www.voe.com.ua/disconnection/detailed',
      {
        city_id: cityId,
        street_id: streetId,
        house_id: houseId,
        form_id: 'disconnection_detailed_search_form'
      },
      {
        params: {
          ajax_form: 1,
          _wrapper_format: 'drupal_ajax',
        },
        headers: {
          'Accept': '*/*',
          'Content-Type': 'multipart/form-data',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36'
        },
      },
    );

    return data.data;
  }
}
