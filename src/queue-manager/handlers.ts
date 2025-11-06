import { ScheduledHandler } from 'aws-lambda';
import { getQueueManagerModule } from './queue-manager.module';

/**
 * Lambda handler for enqueuing subscription updates
 * Triggered by EventBridge every 10 minutes
 */
export const queueManager: ScheduledHandler = async (event) => {
  console.log('QueueManager triggered:', JSON.stringify(event, null, 2));
  await getQueueManagerModule().queueManagerController.enqueueAllUpdates();
};
