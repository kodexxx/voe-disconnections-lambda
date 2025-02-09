import { BotService } from './bot.service';
import { APIGatewayEvent, Context } from 'aws-lambda';

export class BotController {
  constructor(private readonly botService: BotService) {}

  handleWebhook(event: APIGatewayEvent, context: Context) {
    return this.botService.handleWebhook(event, context);
  }
}
