import { ScheduledHandler } from 'aws-lambda';
import { getUpdateManagerModule } from './update-manager.module';

export const prefetch: ScheduledHandler = async (event, context) => {
  console.log('Scheduled event:', JSON.stringify(event, null, 2));
  await getUpdateManagerModule().updateManagerController.prefetch();
};
