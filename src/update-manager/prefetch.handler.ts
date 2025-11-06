import { ScheduledHandler } from 'aws-lambda';
import { getUpdateManagerModule } from './update-manager.module';

/**
 * Lambda handler for manual prefetch trigger
 * Legacy HTTP API endpoint for backward compatibility
 */
export const handler: ScheduledHandler = async (event) => {
  console.log('Scheduled event:', JSON.stringify(event, null, 2));
  await getUpdateManagerModule().updateManagerController.prefetch();
};
