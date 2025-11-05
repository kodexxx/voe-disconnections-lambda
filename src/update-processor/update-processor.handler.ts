import { SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { UpdateQueueMessage } from '../queue-manager/interfaces/update-queue-message.interface';
import { getUpdateProcessorModule } from './update-processor.module';

/**
 * Lambda handler для обробки оновлень з Update Queue
 * Обробляє батчі по 5 повідомлень
 */
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  console.log(
    `UpdateProcessor received ${event.Records.length} messages to process`,
  );

  const updateProcessorModule = getUpdateProcessorModule();
  const batchItemFailures: SQSBatchResponse['batchItemFailures'] = [];

  // Обробити кожне повідомлення з batch
  for (const record of event.Records) {
    try {
      const message: UpdateQueueMessage = JSON.parse(record.body);
      await updateProcessorModule.updateProcessorController.processUpdate(
        message,
      );
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
