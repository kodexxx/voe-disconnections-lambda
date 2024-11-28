import { VoeFetcherService } from '../voe-fetcher/voe-fetcher.service';
import { createEvents, EventAttributes } from 'ics';
import { getDateArray } from '../common/utils/ical-types.util';
import { DisconnectionsRepository } from './disconnections.repository';
import querystring from 'querystring';
import { mergeInterval } from '../common/utils/date.util';
import { elapseTime } from '../common/utils/time.utils';

export class DisconnectionService {
  constructor(
    private readonly voeFetcherService: VoeFetcherService,
    private readonly disconnectionsRepository: DisconnectionsRepository,
  ) {}

  async getDisconnectionsWithCache(
    cityId: string,
    streetId: string,
    houseId: string,
    ignoreCache = false,
  ) {
    if (!ignoreCache) {
      const v = await this.disconnectionsRepository.findOne(
        cityId,
        streetId,
        houseId,
      );
      if (v) {
        return v.value;
      }
    }

    const data = await this.voeFetcherService.getDisconnections(
      cityId,
      streetId,
      houseId,
    );

    const existPrefetch = await this.disconnectionsRepository.findOne(
      cityId,
      streetId,
      houseId,
    );
    if (!existPrefetch) {
      await this.disconnectionsRepository.updateOne(cityId, streetId, houseId, {
        alias: `Auto added #${Date.now()}`,
        value: data,
      });
    }

    return data;
  }

  async prefetchDisconnections() {
    const items = await this.disconnectionsRepository.findMany();

    const promises = items.map(async (v) => {
      const elapse = elapseTime();
      try {
        const { cityId, streetId, houseId } = querystring.parse(v.args);
        console.log(`Start update ${v.alias}`);
        const value = await this.getDisconnectionsWithCache(
          cityId.toString(),
          streetId.toString(),
          houseId.toString(),
          true,
        );

        await this.disconnectionsRepository.updateOne(
          cityId.toString(),
          streetId.toString(),
          houseId.toString(),
          {
            ...v,
            value: mergeInterval([...v.value, ...value]),
          },
        );
        console.log(`Updated ${v.alias}, took ${elapse()}ms`);
      } catch (e) {
        console.error(e);
        console.log(`Update failed ${v.alias}, took ${elapse()}ms`);
      }
    });

    return Promise.allSettled(promises);
  }

  async getDisconnectionsCalendar(
    cityId: string,
    streetId: string,
    houseId: string,
  ) {
    const disconnections = await this.getDisconnectionsWithCache(
      cityId,
      streetId,
      houseId,
    );
    const events = disconnections.map((d) => {
      return {
        uid: `voe_disconnection_${d.to.getTime()}`,
        title: `Відключення світла ${d.possibility}`,
        start: getDateArray(d.from),
        end: getDateArray(d.to),
        alarms: [
          {
            action: 'display',
            trigger: { minutes: -10 },
            description: `Reminder: Disconnection starting soon!`,
          },
        ],
      };
    }) satisfies EventAttributes[];

    const calendar = createEvents(events);
    if (calendar.error) {
      throw calendar.error;
    }

    return calendar.value;
  }
}
