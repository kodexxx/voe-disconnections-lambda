import axios from 'axios';
import { VoeDisconnectionValueItem } from '../disconnections/interfaces/disconnections-item.interface';
import { parse as HTMLParse } from 'node-html-parser';

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
    const data = response?.[1]?.data;
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

          const ts = new Date(
            new Date().getFullYear(),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minutes),
          );
          const ukraineTZOffset = -180;
          const tz = new Date().getTimezoneOffset();
          const tsTZ = new Date(
            ts.getTime() + (tz + ukraineTZOffset) * 1000 * 60,
          );

          const toTZ = new Date(tsTZ.getTime() + 60 * 60 * 1000);

          return { from: tsTZ, to: toTZ, possibility: time.possibility };
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
        // search_type: 0,
        // city: 'м. Вінниця (Вінницька Область/М.Вінниця)',
        city_id: cityId,
        // street: 'вулиця Зодчих',
        street_id: streetId,
        // house: '1',
        house_id: houseId,
        // form_build_id: 'form-zgIeyrfB6SoQ1D3mzF36cyyggdZQ2L3_qSf9u3kpgAk',
        form_id: 'disconnection_detailed_search_form',
        _triggering_element_name: 'op',
        _triggering_element_value: 'Показати',
        _drupal_ajax: '1',
        ajax_page_state: {
          theme: 'personal',
          theme_token: '',
          libraries:
            'ajax_forms/main,classy/base,classy/messages,core/drupal.autocomplete,core/internal.jquery.form,core/normalize,custom/custom,drupal_noty_messages/drupal_noty_messages,extlink/drupal.extlink,filter/caption,paragraphs/drupal.paragraphs.unpublished,personal/global-styling,personal/sticky,personal/toggle_info,personal/type_navigation_unit,poll/drupal.poll-links,search_block/search_block.styles,styling_form_errors/styling_form_errors,system/base',
        },
      },
      {
        params: {
          ajax_form: 1,
          _wrapper_format: 'drupal_ajax',
        },
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );

    return data.data;
  }
}