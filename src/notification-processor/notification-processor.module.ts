import { NotificationProcessorService } from './notification-processor.service';
import { NotificationProcessorController } from './notification-processor.controller';
import { NotificationQueueService } from './notification-queue.service';
import { getBotModule } from '../bot/bot.module';
import { getAwsModule } from '../aws/aws.module';
import { createCachedModule } from '../common/utils/module-cache.util';

export const getNotificationProcessorModule = createCachedModule(
  'notificationProcessor',
  () => {
    const botModule = getBotModule();
    const awsModule = getAwsModule();

    const notificationQueueService = new NotificationQueueService(
      awsModule.sqsClient,
    );

    const notificationProcessorService = new NotificationProcessorService(
      botModule.botService,
    );

    const notificationProcessorController = new NotificationProcessorController(
      notificationProcessorService,
    );

    return {
      notificationProcessorController,
      notificationProcessorService,
      notificationQueueService,
    };
  },
);
