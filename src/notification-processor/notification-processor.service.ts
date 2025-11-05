import { BotService } from '../bot/bot.service';
import { NotificationQueueMessage } from './notification-queue.service';

export class NotificationProcessorService {
  constructor(private readonly botService: BotService) {}

  /**
   * Обробляє одне сповіщення з черги
   */
  async processNotification(message: NotificationQueueMessage): Promise<void> {
    const { userId, data, alias, lastUpdatedAt, attempt = 0 } = message;

    console.log(
      `Sending notification to user ${userId} for ${alias} (attempt ${attempt + 1})`,
    );

    try {
      // Відправити сповіщення через Telegram
      await this.botService.notifyUserWithUpdate(
        userId,
        data,
        alias,
        lastUpdatedAt,
      );

      console.log(`Successfully notified user ${userId} for ${alias}`);
    } catch (e: any) {
      // Логувати специфічні помилки Telegram
      if (e?.error_code === 403) {
        console.warn(
          `User ${userId} has blocked the bot - removing from queue`,
        );
        // НЕ кидати помилку - видалити з черги
        // TODO: Опціонально - видалити підписку користувача з БД
        return;
      } else if (e?.error_code === 400) {
        console.error(
          `Invalid message format for user ${userId}:`,
          e.description,
        );
        // НЕ кидати помилку - проблема з даними, не з API
        return;
      } else if (e?.error_code === 429) {
        console.warn(`Rate limit hit for user ${userId} - will retry`);
        // Кинути помилку - SQS зробить retry з затримкою
        throw e;
      }

      console.error(`Failed to notify user ${userId}:`, e);
      throw e;
    }
  }
}
