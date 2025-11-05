import { QueueManagerService } from './queue-manager';
import { QueueManagerController } from './queue-manager.controller';
import { UpdateQueueService } from './update-queue.service';
import { getBotModule } from '../bot/bot.module';
import { createCachedModule } from '../common/utils/module-cache.util';

export const getQueueManagerModule = createCachedModule('queueManager', () => {
  const botModule = getBotModule();
  const updateQueueService = new UpdateQueueService();

  const queueManagerService = new QueueManagerService(
    botModule.botService,
    updateQueueService,
  );

  const queueManagerController = new QueueManagerController(
    queueManagerService,
  );

  return {
    queueManagerController,
    queueManagerService,
  };
});
