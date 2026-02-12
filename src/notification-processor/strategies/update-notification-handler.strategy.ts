import { BotService } from '../../bot/bot.service';
import { NotificationHandlerStrategy } from '../interfaces/notification-handler-strategy.interface';
import {
  NotificationMessage,
  UpdateNotificationMessage,
} from '../interfaces/notification-queue-message.interface';

export class UpdateNotificationHandlerStrategy
  implements NotificationHandlerStrategy
{
  constructor(private readonly botService: BotService) {}

  canHandle(
    message: NotificationMessage,
  ): message is UpdateNotificationMessage {
    return message.type === 'update';
  }

  async handle(message: NotificationMessage): Promise<void> {
    if (message.type !== 'update') return;
    const {
      userId,
      data,
      alias,
      lastUpdatedAt,
      queueName,
      attempt = 0,
    } = message;

    console.log(
      `Sending update notification to user ${userId} for ${alias} (attempt ${attempt + 1})`,
    );

    await this.botService.notifyUserWithUpdate(
      userId,
      data,
      alias,
      lastUpdatedAt,
      queueName,
    );

    console.log(`Successfully sent update to user ${userId} for ${alias}`);
  }
}
