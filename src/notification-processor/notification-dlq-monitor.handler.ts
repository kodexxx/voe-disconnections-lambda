import { SQSEvent } from 'aws-lambda';
import { NotificationQueueMessage } from './interfaces/notification-queue-message.interface';

/**
 * Lambda handler для моніторингу Notification DLQ
 * Логує сповіщення які не вдалося відправити після 3 спроб
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

      // TODO: Зберегти в DynamoDB таблицю failed-notifications для аналітики
      // TODO: Опційно - відправити в CloudWatch Logs Insights
      // TODO: Опційно - якщо багато помилок від одного користувача - деактивувати підписку
      // TODO: Створити метрику для Dashboard
    } catch (e) {
      console.error('Failed to parse DLQ message:', e);
    }
  }

  // Видалити повідомлення з DLQ після логування
  return { statusCode: 200 };
};
