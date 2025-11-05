import { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { UpdateProcessorService } from './update-processor';
import { UpdateQueueMessage } from './update-queue.service';
import { NotificationQueueService } from '../notification/notification-queue.service';
import { getDisconnectionsModule } from '../disconnections/disconnections.module';
import { getVoeFetcherModule } from '../voe-fetcher/voe-fetcher.module';

/**
 * Lambda handler для обробки оновлень з Update Queue
 * Обробляє батчі по 5 повідомлень
 */
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  console.log(
    `UpdateProcessor received ${event.Records.length} messages to process`,
  );

  const disconnectionsModule = getDisconnectionsModule();
  const voeFetcherModule = getVoeFetcherModule();
  const notificationQueueService = new NotificationQueueService();

  const processor = new UpdateProcessorService(
    disconnectionsModule.disconnectionService,
    voeFetcherModule.voeFetcherService,
    notificationQueueService,
  );

  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  // Обробити кожне повідомлення з batch
  for (const record of event.Records) {
    try {
      const message: UpdateQueueMessage = JSON.parse(record.body);
      await processor.processUpdate(message);
    } catch (e) {
      console.error(`Failed to process message ${record.messageId}:`, e);
      // Додати до failures - SQS повторить тільки це повідомлення
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
