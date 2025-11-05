import {
  SQS,
  SendMessageCommand,
  SendMessageBatchCommand,
} from '@aws-sdk/client-sqs';
import { VoeDisconnectionValueItem } from '../disconnections/interfaces/disconnections-item.interface';

export interface NotificationQueueMessage {
  userId: number;
  data: VoeDisconnectionValueItem[];
  alias: string;
  lastUpdatedAt: string;
  subscriptionArgs: string; // Для логування та аналітики
  attempt?: number;
  enqueuedAt?: string;
  originalError?: string;
}

export class NotificationQueueService {
  private readonly sqs: SQS;
  private readonly queueUrl: string;

  constructor() {
    this.sqs = new SQS({ region: process.env.AWS_REGION || 'us-east-1' });
    this.queueUrl = process.env.NOTIFICATION_QUEUE_URL!;

    if (!this.queueUrl) {
      throw new Error('NOTIFICATION_QUEUE_URL environment variable is not set');
    }
  }

  /**
   * Закинути одне сповіщення в чергу
   */
  async enqueueNotification(message: NotificationQueueMessage): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify({
        ...message,
        enqueuedAt: message.enqueuedAt || new Date().toISOString(),
        attempt: message.attempt || 0,
      }),
    });

    await this.sqs.send(command);
  }

  /**
   * Закинути множинні сповіщення в чергу (batch)
   */
  async enqueueNotificationBatch(
    messages: NotificationQueueMessage[],
  ): Promise<void> {
    if (messages.length === 0) {
      console.log('No notifications to enqueue');
      return;
    }

    const batches = this.chunkArray(messages, 10); // SQS макс 10

    for (const batch of batches) {
      try {
        const command = new SendMessageBatchCommand({
          QueueUrl: this.queueUrl,
          Entries: batch.map((msg, idx) => ({
            Id: idx.toString(),
            MessageBody: JSON.stringify({
              ...msg,
              enqueuedAt: msg.enqueuedAt || new Date().toISOString(),
              attempt: msg.attempt || 0,
            }),
          })),
        });

        await this.sqs.send(command);
      } catch (e) {
        console.error(`Failed to enqueue notification batch:`, e);
        // Не кидати помилку - спробувати наступний batch
      }
    }

    console.log(`Enqueued ${messages.length} notifications`);
  }

  /**
   * Закинути сповіщення для багатьох користувачів про одну подію
   */
  async enqueueNotificationsForUsers(
    userIds: number[],
    data: VoeDisconnectionValueItem[],
    alias: string,
    subscriptionArgs: string,
    lastUpdatedAt: string,
  ): Promise<void> {
    const messages: NotificationQueueMessage[] = userIds.map((userId) => ({
      userId,
      data,
      alias,
      subscriptionArgs,
      lastUpdatedAt,
    }));

    await this.enqueueNotificationBatch(messages);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
