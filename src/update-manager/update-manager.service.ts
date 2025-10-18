import { elapseTime } from '../common/utils/time.utils';
import querystring from 'querystring';
import { VoeDisconnectionValueItem } from '../disconnections/interfaces/disconnections-item.interface';
import { BotService } from '../bot/bot.service';
import { DisconnectionService } from '../disconnections/disconnection.service';
import { VoeFetcherService } from '../voe-fetcher/voe-fetcher.service';

const MOCK_ARGS = 'demo-subscription';

function getMockDisconnections(): VoeDisconnectionValueItem[] {
  const now = Date.now();
  return [
    {
      from: new Date(now + 2 * 60 * 60 * 1000), // +2 години
      to: new Date(now + 6 * 60 * 60 * 1000), // +6 годин
      possibility: 'можливе',
    },
    {
      from: new Date(now + 24 * 60 * 60 * 1000), // +1 день
      to: new Date(now + 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), // +1 день +4 години
      possibility: 'можливе',
    },
    {
      from: new Date(now + 48 * 60 * 60 * 1000), // +2 дні
      to: new Date(now + 48 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000), // +2 дні +3 години
      possibility: 'точне',
    },
  ];
}

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

        // Використовуємо моки для тестової адреси
        const isMockAddress = schedule.args === MOCK_ARGS;
        let updatedSchedule: VoeDisconnectionValueItem[];

        if (isMockAddress) {
          console.log(`Using mock data for ${schedule.alias}`);
          updatedSchedule = getMockDisconnections();
        } else {
          updatedSchedule = await this.voeFetcherService.getDisconnections(
            cityId.toString(),
            streetId.toString(),
            houseId.toString(),
          );
        }

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
