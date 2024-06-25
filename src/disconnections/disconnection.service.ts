import { VoeFetcherService } from '../voe-fetcher/voe-fetcher.service';
import { createEvents, EventAttributes } from 'ics';
import { getDateArray } from '../common/utils/ical-types.util';
import { DisconnectionsRepository } from './disconnections.repository';
import querystring from 'querystring';

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

    return this.voeFetcherService.getDisconnections(cityId, streetId, houseId);
  }

  async prefetchDisconnections() {
    const items = await this.disconnectionsRepository.findMany();

    const promises = items.map(async (v) => {
      const { cityId, streetId, houseId } = querystring.parse(v.args);
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
          value,
        },
      );
    });

    return await Promise.allSettled(promises);
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
