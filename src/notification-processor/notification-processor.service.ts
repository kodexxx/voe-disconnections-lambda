import { GrammyError } from 'grammy';
import { BotService } from '../bot/bot.service';
import {
  NotificationQueueMessage,
  UpdateNotificationMessage,
  BroadcastNotificationMessage,
  QueueChangedNotificationMessage,
} from './interfaces/notification-queue-message.interface';

export class NotificationProcessorService {
  constructor(private readonly botService: BotService) {}

  /**
   * Process a single notification from the queue
   * Handles both update notifications and broadcast messages
   */
  async processNotification(
    message: NotificationQueueMessage &
      (
        | UpdateNotificationMessage
        | BroadcastNotificationMessage
        | QueueChangedNotificationMessage
      ),
  ): Promise<void> {
    const { userId } = message;

    try {
      // Handle different notification types
      if ('type' in message && message.type === 'broadcast') {
        await this.processBroadcastNotification(message);
      } else if ('type' in message && message.type === 'update') {
        await this.processUpdateNotification(message);
      } else if ('type' in message && message.type === 'queue-change') {
        await this.processQueueChangeNotification(message);
      } else {
        // Backward compatibility: treat messages without type as updates
        await this.processUpdateNotification(
          message as UpdateNotificationMessage,
        );
      }
    } catch (e: any) {
      if (e instanceof GrammyError && e.error_code === 403) {
        console.warn(
          `User ${userId} has blocked the bot - removing from queue`,
        );
        // DON'T throw error - remove from queue
        // TODO: Optionally - remove user's subscription from DB
        return;
      } else if (e instanceof GrammyError && e.error_code === 400) {
        console.error(
          `Invalid message format for user ${userId}:`,
          e.description,
        );
        // DON'T throw error - data issue, not API issue
        return;
      } else if (e instanceof GrammyError && e.error_code === 429) {
        console.warn(`Rate limit hit for user ${userId} - will retry`);
        throw e;
      }

      console.error(`Failed to notify user ${userId}:`, e);
      throw e;
    }
  }

  /**
   * Process update notification with disconnection schedule
   */
  private async processUpdateNotification(
    message: UpdateNotificationMessage,
  ): Promise<void> {
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

  /**
   * Process broadcast notification with custom message
   */
  private async processBroadcastNotification(
    message: BroadcastNotificationMessage,
  ): Promise<void> {
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

  /**
   * Process queue change notification
   */
  private async processQueueChangeNotification(
    message: QueueChangedNotificationMessage,
  ): Promise<void> {
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
