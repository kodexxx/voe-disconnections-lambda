import { ScheduledHandler } from 'aws-lambda';
import { QueueManagerService } from './queue-manager';
import { UpdateQueueService } from './update-queue.service';
import { getBotModule } from '../bot/bot.module';

/**
 * Lambda handler для закидання підписок в Update Queue
 * Тригерується EventBridge кожні 10 хвилин
 */
export const handler: ScheduledHandler = async (event) => {
  console.log('QueueManager triggered:', JSON.stringify(event, null, 2));

  const botModule = getBotModule();
  const queueService = new UpdateQueueService();
  const queueManager = new QueueManagerService(
    botModule.botService,
    queueService,
  );

  try {
    const result = await queueManager.enqueueAllUpdates();
    console.log(`QueueManager completed:`, result);
  } catch (e) {
    console.error('QueueManager failed:', e);
    throw e;
  }
};
