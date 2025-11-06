import {
  SQS,
  SendMessageCommand,
  SendMessageBatchCommand,
} from '@aws-sdk/client-sqs';
import { UpdateQueueMessage } from './interfaces/update-queue-message.interface';
import { chunkArray } from '../common/utils/array.utils';
import { Config } from '../config';

export class UpdateQueueService {
  private readonly queueUrl: string;

  constructor(private readonly sqs: SQS) {
    this.queueUrl = Config.UPDATE_QUEUE_URL!;

    if (!this.queueUrl) {
      throw new Error('UPDATE_QUEUE_URL environment variable is not set');
    }
  }

  /**
   * Enqueue a single update to the queue
   */
  async enqueueUpdate(message: UpdateQueueMessage): Promise<void> {
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
   * Enqueue multiple updates to the queue (batch)
   */
  async enqueueBatch(messages: UpdateQueueMessage[]): Promise<void> {
    if (messages.length === 0) {
      console.log('No messages to enqueue');
      return;
    }

    const batches = chunkArray(messages, 10); // SQS max 10

    for (const batch of batches) {
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
    }

    console.log(`Enqueued ${messages.length} update tasks`);
  }
}
