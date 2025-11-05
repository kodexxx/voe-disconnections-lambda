import { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { NotificationQueueMessage } from './interfaces/notification-queue-message.interface';
import { getNotificationProcessorModule } from './notification-processor.module';

/**
 * Lambda handler для відправки сповіщень з Notification Queue
 * Обробляє батчі по 50 повідомлень з 25 concurrent executions
 */
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  console.log(
    `NotificationProcessor received ${event.Records.length} notifications to send`,
  );

  const notificationProcessorModule = getNotificationProcessorModule();
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  // Обробити кожне повідомлення з batch
  for (const record of event.Records) {
    try {
      const message: NotificationQueueMessage = JSON.parse(record.body);
      await notificationProcessorModule.notificationProcessorController.processNotification(
        message,
      );
    } catch (e) {
      console.error(`Failed to process notification ${record.messageId}:`, e);
      // Додати до failures - SQS повторить тільки це повідомлення
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
