import {
  SQS,
  SendMessageCommand,
  SendMessageBatchCommand,
} from '@aws-sdk/client-sqs';
import { VoeDisconnectionValueItem } from '../disconnections/interfaces/disconnections-item.interface';
import {
  NotificationQueueMessage,
  UpdateNotificationMessage,
  BroadcastNotificationMessage,
  QueueChangedNotificationMessage,
} from './interfaces/notification-queue-message.interface';
import { chunkArray } from '../common/utils/array.utils';
import { Config } from '../config';

export class NotificationQueueService {
  private readonly queueUrl: string;

  constructor(private readonly sqs: SQS) {
    this.queueUrl = Config.NOTIFICATION_QUEUE_URL!;

    if (!this.queueUrl) {
      throw new Error('NOTIFICATION_QUEUE_URL environment variable is not set');
    }
  }

  /**
   * Enqueue a single notification to the queue
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
   * Enqueue multiple notifications to the queue (batch)
   */
  async enqueueNotificationBatch(
    messages: NotificationQueueMessage[],
  ): Promise<void> {
    if (messages.length === 0) {
      console.log('No notifications to enqueue');
      return;
    }

    const batches = chunkArray(messages, 10); // SQS max 10

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
        // Don't throw error - try next batch
      }
    }

    console.log(`Enqueued ${messages.length} notifications`);
  }

  /**
   * Enqueue notifications for multiple users about a single event
   */
  async enqueueNotificationsForUsers(
    userIds: number[],
    data: VoeDisconnectionValueItem[],
    alias: string,
    subscriptionArgs: string,
    lastUpdatedAt: string,
    queueName: string,
  ): Promise<void> {
    const messages: UpdateNotificationMessage[] = userIds.map((userId) => ({
      type: 'update',
      userId,
      data,
      alias,
      subscriptionArgs,
      lastUpdatedAt,
      queueName,
    }));

    await this.enqueueNotificationBatch(messages);
  }

  /**
   * Enqueue broadcast message for multiple users
   * This is memory-efficient for large user bases (8k+ users)
   */
  async enqueueBroadcastForUsers(
    userIds: number[],
    message: string,
    parseMode: 'Markdown' | 'MarkdownV2' | 'HTML' = 'Markdown',
  ): Promise<void> {
    const messages: BroadcastNotificationMessage[] = userIds.map((userId) => ({
      type: 'broadcast',
      userId,
      message,
      parseMode,
    }));

    await this.enqueueNotificationBatch(messages);
  }

  /**
   * Enqueue queue change notifications for multiple users
   * Notifies users when their subscription queue number has changed
   */
  async enqueueQueueChangeNotifications(
    userIds: number[],
    alias: string,
    subscriptionArgs: string,
    lastUpdatedAt: string,
    oldQueueName: string,
    newQueueName: string,
  ): Promise<void> {
    const messages: QueueChangedNotificationMessage[] = userIds.map(
      (userId) => ({
        type: 'queue-change',
        userId,
        alias,
        subscriptionArgs,
        lastUpdatedAt,
        oldQueueName,
        newQueueName,
      }),
    );

    await this.enqueueNotificationBatch(messages);
  }
}
