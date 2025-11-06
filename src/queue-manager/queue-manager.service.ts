import { elapseTime } from '../common/utils/time.utils';
import { BotService } from '../bot/bot.service';
import { UpdateQueueService } from './update-queue.service';

export class QueueManagerService {
  constructor(
    private readonly botService: BotService,
    private readonly queueService: UpdateQueueService,
  ) {}

  /**
   * Enqueue all user subscriptions for processing
   */
  async enqueueAllUpdates() {
    const elapse = elapseTime();

    try {
      // 1. Get all users with subscriptions
      const users = await this.botService.getAllUsersWithSubscriptions();
      console.log(`Found ${users.length} users with subscriptions`);

      if (users.length === 0) {
        console.log('No users with subscriptions found');
        return { enqueued: 0 };
      }

      // 2. Group users by subscriptions
      const usersBySubscription = this.groupUsersBySubscription(users);
      console.log(`Enqueuing ${usersBySubscription.size} unique subscriptions`);

      // 3. Create messages for the queue
      const messages = Array.from(usersBySubscription.entries()).map(
        ([subscriptionArgs, userIds]) => ({
          subscriptionArgs,
          userIds,
        }),
      );

      // 4. Enqueue in batches
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
   * Group users by subscriptionArgs
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
