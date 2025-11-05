import { elapseTime } from '../common/utils/time.utils';
import querystring from 'querystring';
import { DisconnectionService } from '../disconnections/disconnection.service';
import { VoeFetcherService } from '../voe-fetcher/voe-fetcher.service';
import { NotificationQueueService } from '../notification/notification-queue.service';
import { UpdateQueueMessage } from './update-queue.service';
import { VoeDisconnectionValueItem } from '../disconnections/interfaces/disconnections-item.interface';

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

export class UpdateProcessorService {
  constructor(
    private readonly disconnectionService: DisconnectionService,
    private readonly voeFetcherService: VoeFetcherService,
    private readonly notificationQueueService: NotificationQueueService,
  ) {}

  /**
   * Обробляє оновлення для однієї підписки
   */
  async processUpdate(message: UpdateQueueMessage): Promise<void> {
    const elapse = elapseTime();
    const { subscriptionArgs, userIds, attempt = 0 } = message;

    console.log(
      `Processing update for ${subscriptionArgs} (attempt ${attempt + 1}, ${userIds.length} users)`,
    );

    try {
      const { cityId, streetId, houseId } = querystring.parse(subscriptionArgs);

      // 1. Отримати існуючі дані
      const existingData =
        await this.disconnectionService.getDisconnectionsSchedule(
          cityId.toString(),
          streetId.toString(),
          houseId.toString(),
        );

      console.log(
        `Fetching data for subscription: ${existingData?.alias || subscriptionArgs}`,
      );

      // 2. Завантажити нові дані з ретраями
      const updatedSchedule = await this.fetchWithRetry(
        subscriptionArgs,
        cityId.toString(),
        streetId.toString(),
        houseId.toString(),
        existingData?.alias,
      );

      // 3. Зберегти дані
      const lastUpdatedAt = new Date().toISOString();
      await this.saveDisconnectionData(
        cityId.toString(),
        streetId.toString(),
        houseId.toString(),
        existingData,
        updatedSchedule,
        lastUpdatedAt,
      );

      // 4. Перевірити зміни та закинути в чергу сповіщень
      const hasChanges = this.checkIfChanged(existingData, updatedSchedule);

      if (hasChanges) {
        // Закинути сповіщення в окрему чергу
        await this.notificationQueueService.enqueueNotificationsForUsers(
          userIds,
          updatedSchedule,
          existingData?.alias || subscriptionArgs,
          subscriptionArgs,
          lastUpdatedAt,
        );

        console.log(
          `Updated and enqueued ${userIds.length} notifications for ${existingData?.alias}, took ${elapse()}ms`,
        );
      } else {
        console.log(
          `No changes for ${existingData?.alias} (${userIds.length} users), took ${elapse()}ms`,
        );
      }

      console.log(
        `Successfully processed ${subscriptionArgs} in ${elapse()}ms`,
      );
    } catch (e) {
      console.error(
        `Failed to process ${subscriptionArgs} (attempt ${attempt + 1}):`,
        e,
      );
      // Кинути помилку - SQS автоматично зробить retry
      throw e;
    }
  }

  /**
   * Перевіряє чи змінилися дані
   */
  private checkIfChanged(
    existingData: any,
    updatedSchedule: VoeDisconnectionValueItem[],
  ): boolean {
    return (
      JSON.stringify(existingData?.value) !== JSON.stringify(updatedSchedule)
    );
  }

  /**
   * Завантажує дані з ретраями та експоненційним backoff
   */
  private async fetchWithRetry(
    subscriptionArgs: string,
    cityId: string,
    streetId: string,
    houseId: string,
    alias?: string,
    maxRetries = 3,
  ): Promise<VoeDisconnectionValueItem[]> {
    // Mock data для demo підписки
    const isMockAddress = subscriptionArgs === MOCK_ARGS;
    if (isMockAddress) {
      console.log(`Using mock data for ${alias}`);
      return getMockDisconnections();
    }

    let lastError: Error;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const data = await this.voeFetcherService.getDisconnections(
          cityId,
          streetId,
          houseId,
        );
        return data;
      } catch (e) {
        lastError = e as Error;
        console.warn(
          `Fetch attempt ${i + 1}/${maxRetries} failed for ${alias}:`,
          e,
        );

        if (i < maxRetries - 1) {
          // Експоненційний backoff: 1s, 2s, 4s
          const delay = Math.pow(2, i) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Зберігає оновлені дані в DynamoDB
   */
  private async saveDisconnectionData(
    cityId: string,
    streetId: string,
    houseId: string,
    existingData: any,
    updatedSchedule: VoeDisconnectionValueItem[],
    lastUpdatedAt: string,
  ) {
    const updatedEntity = {
      ...existingData,
      value: updatedSchedule,
      lastUpdatedAt,
    };

    await this.disconnectionService.updateDisconnection(
      cityId,
      streetId,
      houseId,
      updatedEntity,
    );
  }
}
