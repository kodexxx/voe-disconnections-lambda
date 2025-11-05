import { SQSEvent } from 'aws-lambda';
import { UpdateQueueMessage } from './update-queue.service';

/**
 * Lambda handler для моніторингу Update DLQ
 * Логує повідомлення які провалилися після 3 спроб
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

      // TODO: Відправити в CloudWatch Logs Insights або SNS
      // TODO: Зберегти в окрему DynamoDB таблицю для ручного перегляду
      // TODO: Створити метрику для Dashboard
    } catch (e) {
      console.error('Failed to parse DLQ message:', e);
    }
  }

  // Видалити повідомлення з DLQ після логування
  return { statusCode: 200 };
};
