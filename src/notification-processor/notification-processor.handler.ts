import { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { NotificationQueueMessage } from './interfaces/notification-queue-message.interface';
import { getNotificationProcessorModule } from './notification-processor.module';

/**
 * Lambda handler for sending notifications from Notification Queue
 * Processes batches of 50 messages with 25 concurrent executions
 */
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  console.log(
    `NotificationProcessor received ${event.Records.length} notifications to send`,
  );

  const notificationProcessorModule = getNotificationProcessorModule();
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  // Process each message from batch
  for (const record of event.Records) {
    try {
      const message: NotificationQueueMessage = JSON.parse(record.body);
      await notificationProcessorModule.notificationProcessorController.processNotification(
        message,
      );
    } catch (e) {
      console.error(`Failed to process notification ${record.messageId}:`, e);
      // Add to failures - SQS will retry only this message
      batchItemFailures.push({
        itemIdentifier: record.messageId,
      });
    }
  }

  console.log(
    `NotificationProcessor completed: ${event.Records.length - batchItemFailures.length}/${event.Records.length} successful`,
  );

  return { batchItemFailures };
};
