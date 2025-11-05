import { NotificationProcessorService } from './notification-processor';
import { NotificationProcessorController } from './notification-processor.controller';
import { getBotModule } from '../bot/bot.module';
import { createCachedModule } from '../common/utils/module-cache.util';

export const getNotificationProcessorModule = createCachedModule(
  'notificationProcessor',
  () => {
    const botModule = getBotModule();

    const notificationProcessorService = new NotificationProcessorService(
      botModule.botService,
    );

    const notificationProcessorController = new NotificationProcessorController(
      notificationProcessorService,
    );

    return {
      notificationProcessorController,
      notificationProcessorService,
    };
  },
);
