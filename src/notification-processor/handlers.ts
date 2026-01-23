import { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import {
  NotificationQueueMessage,
  UpdateNotificationMessage,
  BroadcastNotificationMessage,
} from './interfaces/notification-queue-message.interface';
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

  const notificationProcessorModule = getNotificationProcessorModule();
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  // Process each message from batch
  for (const record of event.Records) {
    try {
      const message: NotificationQueueMessage &
        (UpdateNotificationMessage | BroadcastNotificationMessage) = JSON.parse(
        record.body,
      );
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
      const message: NotificationQueueMessage &
        (UpdateNotificationMessage | BroadcastNotificationMessage) = JSON.parse(
        record.body,
      );

      const baseInfo = {
        userId: message.userId,
        attempts: message.attempt,
        enqueuedAt: message.enqueuedAt,
        error: message.originalError,
        messageId: record.messageId,
      };

      // Log type-specific details
      if ('type' in message && message.type === 'update') {
        console.error('Failed update notification:', {
          ...baseInfo,
          alias: message.alias,
          subscriptionArgs: message.subscriptionArgs,
        });
      } else if ('type' in message && message.type === 'broadcast') {
        console.error('Failed broadcast notification:', {
          ...baseInfo,
          messagePreview: message.message.substring(0, 50),
        });
      } else {
        console.error('Failed notification (legacy):', baseInfo);
      }

      // TODO: Save to DynamoDB failed-notifications table for analytics
      // TODO: Optional - send to CloudWatch Logs Insights
      // TODO: Optional - if many errors from one user - deactivate subscription
      // TODO: Create metric for Dashboard
    } catch (e) {
      console.error('Failed to parse DLQ message:', e);
    }
  }

  // Delete messages from DLQ after logging
  return { statusCode: 200 };
};
