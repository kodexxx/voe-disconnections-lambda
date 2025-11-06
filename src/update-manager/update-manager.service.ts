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
    const elapse = elapseTime();

    const users = await this.botService.getAllUsersWithSubscriptions();
    console.log(`Found ${users.length} users with subscriptions`);

    const usersBySubscription = this.groupUsersBySubscription(users);
    console.log(`Processing ${usersBySubscription.size} unique subscriptions`);

    const promises = Array.from(usersBySubscription.entries()).map(
      ([subscriptionArgs, userIds]) =>
        this.updateSubscription(subscriptionArgs, userIds),
    );

    const results = await Promise.allSettled(promises);
    console.log(`Total prefetch took ${elapse()}ms`);
    return results;
  }

  private groupUsersBySubscription(
    users: Array<{ userId: number; subscriptionArgs?: string }>,
  ): Map<string, number[]> {
    const usersBySubscription = new Map<string, number[]>();

    for (const user of users) {
      if (!user.subscriptionArgs) continue;

      const userIds = usersBySubscription.get(user.subscriptionArgs) || [];
      userIds.push(user.userId);
      usersBySubscription.set(user.subscriptionArgs, userIds);
    }

    return usersBySubscription;
  }

  private async updateSubscription(
    subscriptionArgs: string,
    userIds: number[],
  ) {
    const elapse = elapseTime();

    try {
      const { cityId, streetId, houseId } = querystring.parse(subscriptionArgs);

      const existingData =
        await this.disconnectionService.getDisconnectionsSchedule(
          cityId.toString(),
          streetId.toString(),
          houseId.toString(),
        );

      console.log(
        `Start update for subscription: ${existingData?.alias || subscriptionArgs}`,
      );

      const updatedSchedule = await this.voeFetcherService.getDisconnections(
        cityId.toString(),
        streetId.toString(),
        houseId.toString(),
      );

      await this.saveDisconnectionData(
        cityId.toString(),
        streetId.toString(),
        houseId.toString(),
        existingData,
        updatedSchedule,
      );

      await this.notifyIfChanged(
        existingData,
        updatedSchedule,
        userIds,
        subscriptionArgs,
        elapse,
      );
    } catch (e) {
      console.error(`Update failed for subscription ${subscriptionArgs}:`, e);
      console.log(`Update failed, took ${elapse()}ms`);
    }
  }

  private async saveDisconnectionData(
    cityId: string,
    streetId: string,
    houseId: string,
    existingData: any,
    updatedSchedule: VoeDisconnectionValueItem[],
  ) {
    const updatedEntity = {
      ...existingData,
      value: updatedSchedule,
      lastUpdatedAt: new Date().toISOString(),
    };

    await this.disconnectionService.updateDisconnection(
      cityId,
      streetId,
      houseId,
      updatedEntity,
    );
  }

  private async notifyIfChanged(
    existingData: any,
    updatedSchedule: VoeDisconnectionValueItem[],
    userIds: number[],
    subscriptionArgs: string,
    elapse: () => number,
  ) {
    const hasChanges =
      JSON.stringify(existingData?.value) !== JSON.stringify(updatedSchedule);

    if (hasChanges) {
      await this.notifyUsers(
        userIds,
        updatedSchedule,
        existingData?.alias || subscriptionArgs,
        new Date().toISOString(),
      );
      console.log(
        `Updated and notified ${userIds.length} users for ${existingData?.alias}, took ${elapse()}ms`,
      );
    } else {
      console.log(
        `No changes for ${existingData?.alias} (${userIds.length} users), took ${elapse()}ms`,
      );
    }
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
