import { APIGatewayProxyEventV2, Context, Handler } from 'aws-lambda';
import { getBotModule } from './bot.module';

/**
 * Lambda handler for broadcasting messages to all users
 * Manual trigger for admin notifications
 */
export const broadcast: Handler = async (event) => {
  return getBotModule().botController.handleBroadcast(event);
};

/**
 * Lambda handler for Telegram webhook
 * Receives and processes incoming updates from Telegram
 */
export const webhook = async (
  event: APIGatewayProxyEventV2,
  context: Context,
) => {
  return getBotModule().botController.handleWebhook(event, context);
};
