import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { getBotModule } from './bot.module';

/**
 * Lambda handler for Telegram webhook
 * Receives and processes incoming updates from Telegram
 */
export const handler = async (
  event: APIGatewayProxyEventV2,
  context: Context,
) => {
  return getBotModule().botController.handleWebhook(event, context);
};
