import { Handler } from 'aws-lambda';
import { getBotModule } from './bot.module';

/**
 * Lambda handler for broadcasting messages to all users
 * Manual trigger for admin notifications
 */
export const handler: Handler = async (event) => {
  return getBotModule().botController.handleBroadcast(event);
};
