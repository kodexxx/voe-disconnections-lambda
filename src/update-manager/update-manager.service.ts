import { elapseTime } from '../common/utils/time.utils';
import querystring from 'querystring';
import { VoeDisconnectionValueItem } from '../disconnections/interfaces/disconnections-item.interface';
import { BotService } from '../bot/bot.service';
import { DisconnectionService } from '../disconnections/disconnection.service';
import { VoeFetcherService } from '../voe-fetcher/voe-fetcher.service';

export class UpdateManagerService {
  constructor(
    private readonly disconnectionService: DisconnectionService,
    private readonly voeFetcherService: VoeFetcherService,
    private readonly botService: BotService,
  ) {}

  async prefetchDisconnections() {
    const items = await this.disconnectionService.getStoredDisconnections();

    const promises = items.map(async (schedule) => {
      const elapse = elapseTime();
      try {
        const { cityId, streetId, houseId } = querystring.parse(schedule.args);
        console.log(`Start update ${schedule.alias}`);
        const updatedSchedule = await this.voeFetcherService.getDisconnections(
          cityId.toString(),
          streetId.toString(),
          houseId.toString(),
        );

        const updatedEntity = {
          ...schedule,
          value: updatedSchedule,
          lastUpdatedAt: new Date().toISOString(),
        };

        await this.notify(
          schedule.args,
          schedule.value,
          updatedSchedule,
          schedule.alias,
          updatedEntity.lastUpdatedAt,
        );
        await this.disconnectionService.updateDisconnection(
          cityId.toString(),
          streetId.toString(),
          houseId.toString(),
          updatedEntity,
        );
        console.log(`Updated ${schedule.alias}, took ${elapse()}ms`);
      } catch (e) {
        console.error(e);
        console.log(`Update failed ${schedule.alias}, took ${elapse()}ms`);
      }
    });

    return Promise.allSettled(promises);
  }

  private async notify(
    args: string,
    oldData: VoeDisconnectionValueItem[],
    newData: VoeDisconnectionValueItem[],
    alias: string,
    lastUpdatedAt?: string,
  ) {
    if (JSON.stringify(oldData) === JSON.stringify(newData)) {
      return;
    }
    await this.botService.notifyWithUpdate(args, newData, alias, lastUpdatedAt);
  }
}
