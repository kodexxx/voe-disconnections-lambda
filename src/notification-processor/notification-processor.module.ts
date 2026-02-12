import { NotificationProcessorService } from './notification-processor.service';
import { NotificationProcessorController } from './notification-processor.controller';
import { NotificationQueueService } from './notification-queue.service';
import { getBotModule } from '../bot/bot.module';
import { getAwsModule } from '../aws/aws.module';
import { createCachedModule } from '../common/utils/module-cache.util';
import { UpdateNotificationHandlerStrategy } from './strategies/update-notification-handler.strategy';
import { BroadcastNotificationHandlerStrategy } from './strategies/broadcast-notification-handler.strategy';
import { QueueChangeNotificationHandlerStrategy } from './strategies/queue-change-notification-handler.strategy';

export const getNotificationProcessorModule = createCachedModule(
  'notificationProcessor',
  () => {
    const botModule = getBotModule();
    const awsModule = getAwsModule();

    const notificationQueueService = new NotificationQueueService(
      awsModule.sqsClient,
    );

    const notificationProcessorService = new NotificationProcessorService([
      new UpdateNotificationHandlerStrategy(botModule.botService),
      new BroadcastNotificationHandlerStrategy(botModule.botService),
      new QueueChangeNotificationHandlerStrategy(botModule.botService),
    ]);

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
