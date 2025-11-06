import { BotService } from '../bot/bot.service';
import { NotificationQueueMessage } from './interfaces/notification-queue-message.interface';

export class NotificationProcessorService {
  constructor(private readonly botService: BotService) {}

  /**
   * Process a single notification from the queue
   */
  async processNotification(message: NotificationQueueMessage): Promise<void> {
    const { userId, data, alias, lastUpdatedAt, attempt = 0 } = message;

    console.log(
      `Sending notification to user ${userId} for ${alias} (attempt ${attempt + 1})`,
    );

    try {
      // Send notification via Telegram
      await this.botService.notifyUserWithUpdate(
        userId,
        data,
        alias,
        lastUpdatedAt,
      );

      console.log(`Successfully notified user ${userId} for ${alias}`);
    } catch (e: any) {
      // Log specific Telegram errors
      if (e?.error_code === 403) {
        console.warn(
          `User ${userId} has blocked the bot - removing from queue`,
        );
        // DON'T throw error - remove from queue
        // TODO: Optionally - remove user's subscription from DB
        return;
      } else if (e?.error_code === 400) {
        console.error(
          `Invalid message format for user ${userId}:`,
          e.description,
        );
        // DON'T throw error - data issue, not API issue
        return;
      } else if (e?.error_code === 429) {
        console.warn(`Rate limit hit for user ${userId} - will retry`);
        // Throw error - SQS will retry with delay
        throw e;
      }

      console.error(`Failed to notify user ${userId}:`, e);
      throw e;
    }
  }
}
