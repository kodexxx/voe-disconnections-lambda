import { ScheduledHandler } from 'aws-lambda';
import { getQueueManagerModule } from './queue-manager.module';

/**
 * Lambda handler для закидання підписок в Update Queue
 * Тригерується EventBridge кожні 10 хвилин
 */
export const handler: ScheduledHandler = async (event) => {
  console.log('QueueManager triggered:', JSON.stringify(event, null, 2));
  await getQueueManagerModule().queueManagerController.enqueueAllUpdates();
};
