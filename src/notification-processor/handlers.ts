import { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { NotificationMessage } from './interfaces/notification-queue-message.interface';
import { getNotificationProcessorModule } from './notification-processor.module';

/**
 * Lambda handler for sending notifications from Notification Queue
 * Processes batches of 20 messages with 10 concurrent executions
 */
export const notificationProcessor = async (
  event: SQSEvent,
): Promise<SQSBatchResponse> => {
  console.log(
    `NotificationProcessor received ${event.Records.length} notifications to send`,
  );

  const { notificationProcessorController } = getNotificationProcessorModule();
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body) as NotificationMessage;
      await notificationProcessorController.processNotification(message);
    } catch (e) {
      console.error(`Failed to process notification ${record.messageId}:`, e);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  console.log(
    `NotificationProcessor completed: ${event.Records.length - batchItemFailures.length}/${event.Records.length} successful`,
  );

  return { batchItemFailures };
};

/**
 * Lambda handler for monitoring Notification DLQ
 * Logs notifications that failed to send after 3 attempts
 */
export const notificationDlqMonitor = async (event: SQSEvent) => {
  console.error(
    `⚠️ Notification DLQ received ${event.Records.length} failed notifications`,
  );

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.body) as NotificationMessage;

      console.error('Failed notification:', {
        type: message.type,
        userId: message.userId,
        attempts: message.attempt,
        enqueuedAt: message.enqueuedAt,
        error: message.originalError,
        messageId: record.messageId,
      });

      // TODO: Save to DynamoDB failed-notifications table for analytics
      // TODO: Optional - send to CloudWatch Logs Insights
      // TODO: Optional - if many errors from one user - deactivate subscription
      // TODO: Create metric for Dashboard
    } catch (e) {
      console.error('Failed to parse DLQ message:', e);
    }
  }

  return { statusCode: 200 };
};
