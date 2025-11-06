import { SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { UpdateQueueMessage } from '../queue-manager/interfaces/update-queue-message.interface';
import { getUpdateProcessorModule } from './update-processor.module';

/**
 * Lambda handler for monitoring Update DLQ
 * Logs messages that failed after 3 attempts
 */
export const updateDlqMonitor = async (event: SQSEvent) => {
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

export const updateProcessor = async (
  event: SQSEvent,
): Promise<SQSBatchResponse> => {
  console.log(
    `UpdateProcessor received ${event.Records.length} messages to process`,
  );

  const updateProcessorModule = getUpdateProcessorModule();
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  // Process each message from batch
  for (const record of event.Records) {
    try {
      const message: UpdateQueueMessage = JSON.parse(record.body);
      await updateProcessorModule.updateProcessorController.processUpdate(
        message,
      );
    } catch (e) {
      console.error(`Failed to process message ${record.messageId}:`, e);
      // Add to failures - SQS will retry only this message
      batchItemFailures.push({
        itemIdentifier: record.messageId,
      });
    }
  }

  console.log(
    `UpdateProcessor completed: ${event.Records.length - batchItemFailures.length}/${event.Records.length} successful`,
  );

  return { batchItemFailures };
};
