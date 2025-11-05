import { elapseTime } from '../common/utils/time.utils';
import { BotService } from '../bot/bot.service';
import { UpdateQueueService } from './update-queue.service';

export class QueueManagerService {
  constructor(
    private readonly botService: BotService,
    private readonly queueService: UpdateQueueService,
  ) {}

  /**
   * Закидає всі підписки користувачів в чергу для обробки
   */
  async enqueueAllUpdates() {
    const elapse = elapseTime();

    try {
      // 1. Отримати всіх користувачів з підписками
      const users = await this.botService.getAllUsersWithSubscriptions();
      console.log(`Found ${users.length} users with subscriptions`);

      if (users.length === 0) {
        console.log('No users with subscriptions found');
        return { enqueued: 0 };
      }

      // 2. Групувати користувачів по підписках
      const usersBySubscription = this.groupUsersBySubscription(users);
      console.log(`Enqueuing ${usersBySubscription.size} unique subscriptions`);

      // 3. Створити повідомлення для черги
      const messages = Array.from(usersBySubscription.entries()).map(
        ([subscriptionArgs, userIds]) => ({
          subscriptionArgs,
          userIds,
        }),
      );

      // 4. Закинути в чергу батчами
      await this.queueService.enqueueBatch(messages);

      console.log(
        `Successfully enqueued ${messages.length} updates in ${elapse()}ms`,
      );
      return { enqueued: messages.length };
    } catch (e) {
      console.error(`Failed to enqueue updates:`, e);
      console.log(`Enqueue failed, took ${elapse()}ms`);
      throw e;
    }
  }

  /**
   * Групує користувачів за subscriptionArgs
   */
  private groupUsersBySubscription(
    users: Array<{ userId: number; subscriptionArgs?: string }>,
  ): Map<string, number[]> {
    const usersBySubscription = new Map<string, number[]>();

    for (const user of users) {
      if (!user.subscriptionArgs) continue;

      const userIds = usersBySubscription.get(user.subscriptionArgs) || [];
      userIds.push(user.userId);
      usersBySubscription.set(user.subscriptionArgs, userIds);
    }

    return usersBySubscription;
  }
}
