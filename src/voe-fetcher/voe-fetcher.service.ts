import { VoeDisconnectionValueItem } from '../disconnections/interfaces/disconnections-item.interface';
import { parse as HTMLParse } from 'node-html-parser';
import {
  getDateWithTzOffset,
  getUkraineUtcOffsetMinutes,
  mergeInterval,
} from '../common/utils/date.util';
import {
  VOE_CELL_DURATION_MS,
  VOE_HALF_CELL_DURATION_MS,
} from './voe-fetcher.constants';
import querystring from 'querystring';
import axios, { AxiosInstance } from 'axios';
import { HttpsProxyAgent } from 'hpagent';
import { Config } from '../config';
import { randomChoice } from 'src/common/utils/array.utils';

export class VoeFetcherService {
  private readonly axiosInstance: AxiosInstance;
  private readonly proxyList = Config.VOE_PROXY_URL.map(
    (url) =>
      new HttpsProxyAgent({
        proxy: url,
        keepAlive: false,
        maxSockets: 100,
      }),
  );

  constructor() {
    // Initialize axios with proxy if configured
    this.axiosInstance = axios.create({
      headers: {
        accept: 'application/json, text/javascript, */*; q=0.01',
        referer: 'https://www.voe.com.ua/disconnection/detailed',
        'user-agent': `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36`,
        'x-requested-with': 'XMLHttpRequest',
      },
    });
  }
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

  async getCityByName(
    cityName: string,
  ): Promise<{ id: string; name: string }[]> {
    const params = querystring.stringify({
      q: cityName,
    });
    const url = `https://www.voe.com.ua/disconnection/detailed/autocomplete/read_city?${params}`;
    console.log('Fetching cities from:', url);

    const response = await this.axiosInstance.get(url, {
      httpsAgent: randomChoice(this.proxyList),
    });
    const data = response.data;

    return (
      data?.map((item) => {
        const root = HTMLParse(item.label);
        const id = root.querySelector('div').attributes['data-id'];
        return {
          name: item.value,
          id,
        };
      }) ?? []
    );
  }

  async getStreetByName(
    cityId: string,
    streetName: string,
  ): Promise<{ id: string; name: string }[]> {
    const params = querystring.stringify({
      q: streetName,
    });
    const url = `https://www.voe.com.ua/disconnection/detailed/autocomplete/read_street/${cityId}?${params}`;
    console.log('Fetching streets from:', url);

    const response = await this.axiosInstance.get(url, {
      httpsAgent: randomChoice(this.proxyList),
    });
    const data = response.data;

    return (
      data?.map((item) => {
        const root = HTMLParse(item.label);
        const id = root.querySelector('div').attributes['data-id'];
        return {
          name: item.value,
          id,
        };
      }) ?? []
    );
  }

  async getHouseByName(
    streetId: string,
    houseName: string,
  ): Promise<{ id: string; name: string }[]> {
    const params = querystring.stringify({
      q: houseName,
    });
    const url = `https://www.voe.com.ua/disconnection/detailed/autocomplete/read_house/${streetId}?${params}`;
    console.log('Fetching houses from:', url);

    const response = await this.axiosInstance.get(url, {
      httpsAgent: randomChoice(this.proxyList),
    });
    const data = response.data;

    return (
      data?.map((item) => {
        const root = HTMLParse(item.label);
        const id = root.querySelector('div').attributes['data-id'];
        return {
          name: item.value,
          id,
        };
      }) ?? []
    );
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
        duration: number;
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
        const halfDiscontented = item.querySelector('div.has_disconnection');

        if (halfDiscontented) {
          const isFirstHalf = halfDiscontented.classList.contains('left');
          const possibility = halfDiscontented.classList.contains('confirm_1')
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

        if (disconnected) {
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

    return mergeInterval(items);
  }

  private async getDetailedDisconnection(
    cityId: string,
    streetId: string,
    houseId: string,
  ): Promise<Array<{ command: string; data?: string }>> {
    const params = querystring.stringify({
      ajax_form: 1,
      _wrapper_format: 'drupal_ajax',
    });
    const url = `https://www.voe.com.ua/disconnection/detailed?${params}`;
    console.log('Fetching detailed disconnection from:', url);

    const response = await this.axiosInstance.post(
      url,
      new URLSearchParams({
        city_id: cityId,
        street_id: streetId,
        house_id: houseId,
        form_id: 'disconnection_detailed_search_form',
      }),
      {
        headers: {
          'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        },
        httpsAgent: randomChoice(this.proxyList),
      },
    );

    return response.data;
  }
}
