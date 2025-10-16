import { createEvents, EventAttributes } from 'ics';
import { getDateArray } from '../common/utils/ical-types.util';
import { DisconnectionsRepository } from './disconnections.repository';
import {
  VoeDisconnectionEntity,
  VoeDisconnectionValueItem,
} from './interfaces/disconnections-item.interface';
import { VoeFetcherService } from '../voe-fetcher/voe-fetcher.service';

export class DisconnectionService {
  constructor(
    private readonly disconnectionsRepository: DisconnectionsRepository,
    private readonly voeFetcherService: VoeFetcherService,
  ) {}

  async getDisconnectionsScheduleCalendar(
    cityId: string,
    streetId: string,
    houseId: string,
  ) {
    const disconnections = await this.disconnectionsRepository.findOne(
      cityId,
      streetId,
      houseId,
    );

    return this.generateCalendar(disconnections?.value ?? []);
  }

  getDisconnectionsSchedule(cityId: string, streetId: string, houseId: string) {
    return this.disconnectionsRepository.findOne(cityId, streetId, houseId);
  }

  getStoredDisconnections() {
    return this.disconnectionsRepository.findMany();
  }

  updateDisconnection(
    cityId: string,
    streetId: string,
    houseId: string,
    update: Partial<VoeDisconnectionEntity>,
  ) {
    return this.disconnectionsRepository.updateOne(
      cityId,
      streetId,
      houseId,
      update,
    );
  }

  async registerDisconnection(
    cityId: string,
    streetId: string,
    houseId: string,
    alias: string,
  ) {
    const exist = await this.getDisconnectionsSchedule(
      cityId,
      streetId,
      houseId,
    );
    if (exist) {
      return exist;
    }

    const updatedSchedule = await this.voeFetcherService.getDisconnections(
      cityId.toString(),
      streetId.toString(),
      houseId.toString(),
    );

    await this.updateDisconnection(cityId, streetId, houseId, {
      alias,
      value: updatedSchedule,
      lastUpdatedAt: new Date().toISOString(),
    });

    return this.getDisconnectionsSchedule(cityId, streetId, houseId);
  }

  private generateCalendar(disconnections: VoeDisconnectionValueItem[]) {
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
