import { APIGatewayEvent, Context } from 'aws-lambda';
import { getBotModule } from './bot.module';

export async function botWebhookHandler(
  event: APIGatewayEvent,
  context: Context,
) {
  return getBotModule().botController.handleWebhook(event, context);
}
