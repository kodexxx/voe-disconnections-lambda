import {
  SQS,
  SendMessageCommand,
  SendMessageBatchCommand,
} from '@aws-sdk/client-sqs';
import { UpdateQueueMessage } from './interfaces/update-queue-message.interface';
import { chunkArray } from '../common/utils/array.utils';
import { Config } from '../config';

export class UpdateQueueService {
  private readonly sqs: SQS;
  private readonly queueUrl: string;

  constructor() {
    this.sqs = new SQS({ region: Config.AWS_REGION });
    this.queueUrl = Config.UPDATE_QUEUE_URL!;

    if (!this.queueUrl) {
      throw new Error('UPDATE_QUEUE_URL environment variable is not set');
    }
  }

  /**
   * Закинути одне оновлення в чергу
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
   * Закинути множинні оновлення в чергу (batch)
   */
  async enqueueBatch(messages: UpdateQueueMessage[]): Promise<void> {
    if (messages.length === 0) {
      console.log('No messages to enqueue');
      return;
    }

    const batches = chunkArray(messages, 10); // SQS макс 10

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
