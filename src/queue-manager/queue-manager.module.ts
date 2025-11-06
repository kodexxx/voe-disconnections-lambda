import { QueueManagerService } from './queue-manager.service';
import { QueueManagerController } from './queue-manager.controller';
import { UpdateQueueService } from './update-queue.service';
import { getBotModule } from '../bot/bot.module';
import { getAwsModule } from '../aws/aws.module';
import { createCachedModule } from '../common/utils/module-cache.util';

export const getQueueManagerModule = createCachedModule('queueManager', () => {
  const botModule = getBotModule();
  const awsModule = getAwsModule();
  const updateQueueService = new UpdateQueueService(awsModule.sqsClient);

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
