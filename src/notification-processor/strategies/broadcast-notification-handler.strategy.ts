import { BotService } from '../../bot/bot.service';
import { NotificationHandlerStrategy } from '../interfaces/notification-handler-strategy.interface';
import {
  NotificationMessage,
  BroadcastNotificationMessage,
} from '../interfaces/notification-queue-message.interface';

export class BroadcastNotificationHandlerStrategy
  implements NotificationHandlerStrategy
{
  constructor(private readonly botService: BotService) {}

  canHandle(
    message: NotificationMessage,
  ): message is BroadcastNotificationMessage {
    return message.type === 'broadcast';
  }

  async handle(message: NotificationMessage): Promise<void> {
    if (message.type !== 'broadcast') return;
    const {
      userId,
      message: text,
      parseMode = 'Markdown',
      attempt = 0,
    } = message;

    console.log(
      `Sending broadcast message to user ${userId} (attempt ${attempt + 1})`,
    );

    await this.botService.sendMessageToUser(userId, text, parseMode);

    console.log(`Successfully sent broadcast to user ${userId}`);
  }
}
