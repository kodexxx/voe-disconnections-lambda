import { SQSEvent } from 'aws-lambda';
import { UpdateQueueMessage } from '../queue-manager/interfaces/update-queue-message.interface';

/**
 * Lambda handler for monitoring Update DLQ
 * Logs messages that failed after 3 attempts
 */
export const handler = async (event: SQSEvent) => {
  console.error(
    `⚠️ Update DLQ received ${event.Records.length} failed messages`,
  );

  for (const record of event.Records) {
    try {
      const message: UpdateQueueMessage = JSON.parse(record.body);

      console.error('Failed update task:', {
        subscriptionArgs: message.subscriptionArgs,
        userIds: message.userIds,
        userCount: message.userIds.length,
        attempts: message.attempt,
        enqueuedAt: message.enqueuedAt,
        error: message.originalError,
        messageId: record.messageId,
      });

      // TODO: Send to CloudWatch Logs Insights or SNS
      // TODO: Save to separate DynamoDB table for manual review
      // TODO: Create metric for Dashboard
    } catch (e) {
      console.error('Failed to parse DLQ message:', e);
    }
  }

  // Delete messages from DLQ after logging
  return { statusCode: 200 };
};
