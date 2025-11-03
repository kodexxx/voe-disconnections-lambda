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
    const elapse = elapseTime();

    const users = await this.botService.getAllUsersWithSubscriptions();

    console.log(`Found ${users.length} users with subscriptions`);

    const usersBySubscription = new Map<string, number[]>();
    for (const user of users) {
      if (!user.subscriptionArgs) continue;

      const userIds = usersBySubscription.get(user.subscriptionArgs) || [];
      userIds.push(user.userId);
      usersBySubscription.set(user.subscriptionArgs, userIds);
    }

    console.log(`Processing ${usersBySubscription.size} unique subscriptions`);

    const promises = Array.from(usersBySubscription.entries()).map(
      async ([subscriptionArgs, userIds]) => {
        const updateElapse = elapseTime();
        try {
          const { cityId, streetId, houseId } =
            querystring.parse(subscriptionArgs);

          const existingData =
            await this.disconnectionService.getDisconnectionsSchedule(
              cityId.toString(),
              streetId.toString(),
              houseId.toString(),
            );

          console.log(
            `Start update for subscription: ${existingData?.alias || subscriptionArgs}`,
          );

          const isMockAddress = subscriptionArgs === MOCK_ARGS;
          let updatedSchedule: VoeDisconnectionValueItem[];

          if (isMockAddress) {
            console.log(`Using mock data for ${existingData?.alias}`);
            updatedSchedule = getMockDisconnections();
          } else {
            updatedSchedule = await this.voeFetcherService.getDisconnections(
              cityId.toString(),
              streetId.toString(),
              houseId.toString(),
            );
          }

          const updatedEntity = {
            ...existingData,
            value: updatedSchedule,
            lastUpdatedAt: new Date().toISOString(),
          };

          await this.disconnectionService.updateDisconnection(
            cityId.toString(),
            streetId.toString(),
            houseId.toString(),
            updatedEntity,
          );

          if (
            JSON.stringify(existingData?.value) !==
            JSON.stringify(updatedSchedule)
          ) {
            await this.notifyUsers(
              userIds,
              updatedSchedule,
              existingData?.alias || subscriptionArgs,
              updatedEntity.lastUpdatedAt,
            );
            console.log(
              `Updated and notified ${userIds.length} users for ${existingData?.alias}, took ${updateElapse()}ms`,
            );
          } else {
            console.log(
              `No changes for ${existingData?.alias} (${userIds.length} users), took ${updateElapse()}ms`,
            );
          }
        } catch (e) {
          console.error(
            `Update failed for subscription ${subscriptionArgs}:`,
            e,
          );
          console.log(`Update failed, took ${updateElapse()}ms`);
        }
      },
    );

    const results = await Promise.allSettled(promises);
    console.log(`Total prefetch took ${elapse()}ms`);
    return results;
  }

  private async notifyUsers(
    userIds: number[],
    data: VoeDisconnectionValueItem[],
    alias: string,
    lastUpdatedAt?: string,
  ) {
    const promises = userIds.map(async (userId) => {
      try {
        await this.botService.notifyUserWithUpdate(
          userId,
          data,
          alias,
          lastUpdatedAt,
        );
      } catch (e) {
        console.error(`Failed to notify user ${userId}:`, e);
      }
    });

    return await Promise.all(promises);
  }
}
