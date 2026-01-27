import { elapseTime } from '../common/utils/time.utils';
import querystring from 'querystring';
import { DisconnectionService } from '../disconnections/disconnection.service';
import { VoeFetcherService } from '../voe-fetcher/voe-fetcher.service';
import { NotificationQueueService } from '../notification-processor/notification-queue.service';
import { UpdateQueueMessage } from '../queue-manager/interfaces/update-queue-message.interface';
import {
  VoeDisconnectionEntity,
  VoeDisconnectionValueItem,
} from '../disconnections/interfaces/disconnections-item.interface';

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
      const updatedSchedule = await this.voeFetcherService.getDisconnections(
        cityId.toString(),
        streetId.toString(),
        houseId.toString(),
      );

      // 3. Save data
      const lastUpdatedAt = new Date().toISOString();
      await this.saveDisconnectionData(
        cityId.toString(),
        streetId.toString(),
        houseId.toString(),
        existingData,
        updatedSchedule.intervals,
        lastUpdatedAt,
        updatedSchedule.queueName,
      );

      // 4. Check for changes and enqueue notifications
      const hasChanges = this.checkIfChanged(
        existingData,
        updatedSchedule.intervals,
      );

      if (hasChanges) {
        // Enqueue notifications to a separate queue
        await this.notificationQueueService.enqueueNotificationsForUsers(
          userIds,
          updatedSchedule.intervals,
          existingData?.alias || subscriptionArgs,
          subscriptionArgs,
          lastUpdatedAt,
          updatedSchedule.queueName,
        );

        console.log(
          `Updated and enqueued ${userIds.length} notifications for ${existingData?.alias}, took ${elapse()}ms`,
        );
      } else {
        console.log(
          `No changes for ${existingData?.alias} (${userIds.length} users), took ${elapse()}ms`,
        );
      }

      const hasQueueChanges = this.checkIfQueueChanged(
        existingData,
        updatedSchedule.queueName,
      );

      if (hasQueueChanges) {
        // Enqueue queue change notifications
        await this.notificationQueueService.enqueueQueueChangeNotifications(
          userIds,
          existingData?.alias || subscriptionArgs,
          subscriptionArgs,
          lastUpdatedAt,
          existingData.queueName,
          updatedSchedule.queueName,
        );

        console.log(
          `Queue changed for ${existingData?.alias}: ${existingData.queueName} -> ${updatedSchedule.queueName} (${userIds.length} users)`,
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
    existingData: VoeDisconnectionEntity,
    updatedSchedule: VoeDisconnectionValueItem[],
  ): boolean {
    return (
      JSON.stringify(existingData?.value) !== JSON.stringify(updatedSchedule)
    );
  }

  private checkIfQueueChanged(
    existingData: VoeDisconnectionEntity,
    newQueueName: string,
  ): boolean {
    return existingData.queueName !== newQueueName;
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
    queueName: string,
  ) {
    const updatedEntity = {
      ...existingData,
      value: updatedSchedule,
      lastUpdatedAt,
      queueName,
    };

    await this.disconnectionService.updateDisconnection(
      cityId,
      streetId,
      houseId,
      updatedEntity,
    );
  }
}
