import { SQSEvent } from 'aws-lambda';
import { NotificationQueueMessage } from './interfaces/notification-queue-message.interface';

/**
 * Lambda handler for monitoring Notification DLQ
 * Logs notifications that failed to send after 3 attempts
 */
export const handler = async (event: SQSEvent) => {
  console.error(
    `⚠️ Notification DLQ received ${event.Records.length} failed notifications`,
  );

  for (const record of event.Records) {
    try {
      const message: NotificationQueueMessage = JSON.parse(record.body);

      console.error('Failed notification:', {
        userId: message.userId,
        alias: message.alias,
        subscriptionArgs: message.subscriptionArgs,
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

  // Delete messages from DLQ after logging
  return { statusCode: 200 };
};
