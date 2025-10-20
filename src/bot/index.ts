import { APIGatewayProxyEventV2, Context, Handler } from 'aws-lambda';
import { getBotModule } from './bot.module';

export const botWebhookHandler = async (
  event: APIGatewayProxyEventV2,
  context: Context,
) => {
  return getBotModule().botController.handleWebhook(event, context);
};

export const broadcastMessage: Handler = async (event, context) => {
  return getBotModule().botController.handleBroadcast(event);
};
