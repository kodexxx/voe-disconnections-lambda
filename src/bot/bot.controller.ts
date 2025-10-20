import { BotService } from './bot.service';
import { APIGatewayProxyEventV2, Context } from 'aws-lambda';

export class BotController {
  constructor(private readonly botService: BotService) {}

  handleWebhook(event: APIGatewayProxyEventV2, context?: Context) {
    return this.botService.handleWebhook(event, context);
  }

  handleBroadcast(event: any) {
    return this.botService.handleBroadcast(event);
  }
}
