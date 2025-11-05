import { UpdateProcessorService } from './update-processor';
import { UpdateProcessorController } from './update-processor.controller';
import { NotificationQueueService } from '../notification/notification-queue.service';
import { getDisconnectionsModule } from '../disconnections/disconnections.module';
import { getVoeFetcherModule } from '../voe-fetcher/voe-fetcher.module';
import { createCachedModule } from '../common/utils/module-cache.util';

export const getUpdateProcessorModule = createCachedModule(
  'updateProcessor',
  () => {
    const disconnectionsModule = getDisconnectionsModule();
    const voeFetcherModule = getVoeFetcherModule();
    const notificationQueueService = new NotificationQueueService();

    const updateProcessorService = new UpdateProcessorService(
      disconnectionsModule.disconnectionService,
      voeFetcherModule.voeFetcherService,
      notificationQueueService,
    );

    const updateProcessorController = new UpdateProcessorController(
      updateProcessorService,
    );

    return {
      updateProcessorController,
      updateProcessorService,
    };
  },
);
