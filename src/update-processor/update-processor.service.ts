import { elapseTime } from '../common/utils/time.utils';
import querystring from 'querystring';
import { DisconnectionService } from '../disconnections/disconnection.service';
import { VoeFetcherService } from '../voe-fetcher/voe-fetcher.service';
import { NotificationQueueService } from '../notification-processor/notification-queue.service';
import { UpdateQueueMessage } from '../queue-manager/interfaces/update-queue-message.interface';
import { VoeDisconnectionValueItem } from '../disconnections/interfaces/disconnections-item.interface';
import {
  MOCK_SUBSCRIPTION_ARGS,
  getMockDisconnections,
} from './utils/mock-data.utils';

export class UpdateProcessorService {
  constructor(
    private readonly disconnectionService: DisconnectionService,
    private readonly voeFetcherService: VoeFetcherService,
    private readonly notificationQueueService: NotificationQueueService,
  ) {}

  /**
   * Process an update for a single subscription
   */
  async processUpdate(message: UpdateQueueMessage): Promise<void> {
    const elapse = elapseTime();
    const { subscriptionArgs, userIds, attempt = 0 } = message;

    console.log(
      `Processing update for ${subscriptionArgs} (attempt ${attempt + 1}, ${userIds.length} users)`,
    );

    try {
      const { cityId, streetId, houseId } = querystring.parse(subscriptionArgs);

      // 1. Get existing data
      const existingData =
        await this.disconnectionService.getDisconnectionsSchedule(
          cityId.toString(),
          streetId.toString(),
          houseId.toString(),
        );

      console.log(
        `Fetching data for subscription: ${existingData?.alias || subscriptionArgs}`,
      );

      // 2. Fetch new data with retries
      const updatedSchedule = await this.fetchWithRetry(
        subscriptionArgs,
        cityId.toString(),
        streetId.toString(),
        houseId.toString(),
        existingData?.alias,
      );

      // 3. Save data
      const lastUpdatedAt = new Date().toISOString();
      await this.saveDisconnectionData(
        cityId.toString(),
        streetId.toString(),
        houseId.toString(),
        existingData,
        updatedSchedule,
        lastUpdatedAt,
      );

      // 4. Check for changes and enqueue notifications
      const hasChanges = this.checkIfChanged(existingData, updatedSchedule);

      if (hasChanges) {
        // Enqueue notifications to a separate queue
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
      // Throw error - SQS will automatically retry
      throw e;
    }
  }

  /**
   * Check if data has changed
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
   * Fetch data with retries and exponential backoff
   */
  private async fetchWithRetry(
    subscriptionArgs: string,
    cityId: string,
    streetId: string,
    houseId: string,
    alias?: string,
    maxRetries = 3,
  ): Promise<VoeDisconnectionValueItem[]> {
    // Mock data for demo subscription
    const isMockAddress = subscriptionArgs === MOCK_SUBSCRIPTION_ARGS;
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
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, i) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Save updated data to DynamoDB
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
