import { BotService } from '../../bot/bot.service';
import { NotificationHandlerStrategy } from '../interfaces/notification-handler-strategy.interface';
import {
  NotificationMessage,
  QueueChangedNotificationMessage,
} from '../interfaces/notification-queue-message.interface';

export class QueueChangeNotificationHandlerStrategy
  implements NotificationHandlerStrategy
{
  constructor(private readonly botService: BotService) {}

  canHandle(
    message: NotificationMessage,
  ): message is QueueChangedNotificationMessage {
    return message.type === 'queue-change';
  }

  async handle(message: NotificationMessage): Promise<void> {
    if (message.type !== 'queue-change') return;
    const {
      userId,
      alias,
      oldQueueName,
      newQueueName,
      lastUpdatedAt,
      attempt = 0,
    } = message;

    console.log(
      `Sending queue change notification to user ${userId} for ${alias} (${oldQueueName} -> ${newQueueName}, attempt ${attempt + 1})`,
    );

    await this.botService.notifyUserAboutQueueChange(
      userId,
      alias,
      oldQueueName,
      newQueueName,
      lastUpdatedAt,
    );

    console.log(
      `Successfully sent queue change notification to user ${userId} for ${alias}`,
    );
  }
}
