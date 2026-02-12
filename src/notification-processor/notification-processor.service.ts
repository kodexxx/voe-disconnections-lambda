import { GrammyError } from 'grammy';
import { NotificationHandlerStrategy } from './interfaces/notification-handler-strategy.interface';
import { NotificationMessage } from './interfaces/notification-queue-message.interface';

export class NotificationProcessorService {
  constructor(private readonly strategies: NotificationHandlerStrategy[]) {}

  /**
   * Process a single notification from the queue
   * Delegates to the matching strategy based on message type
   */
  async processNotification(message: NotificationMessage): Promise<void> {
    const { userId } = message;

    try {
      const strategy = this.strategies.find((s) => s.canHandle(message));
      await strategy?.handle(message);
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
}
