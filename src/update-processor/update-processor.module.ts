import { UpdateProcessorService } from './update-processor.service';
import { UpdateProcessorController } from './update-processor.controller';
import { getDisconnectionsModule } from '../disconnections/disconnections.module';
import { getVoeFetcherModule } from '../voe-fetcher/voe-fetcher.module';
import { getNotificationProcessorModule } from '../notification-processor/notification-processor.module';
import { createCachedModule } from '../common/utils/module-cache.util';

export const getUpdateProcessorModule = createCachedModule(
  'updateProcessor',
  () => {
    const disconnectionsModule = getDisconnectionsModule();
    const voeFetcherModule = getVoeFetcherModule();
    const notificationProcessorModule = getNotificationProcessorModule();

    const updateProcessorService = new UpdateProcessorService(
      disconnectionsModule.disconnectionService,
      voeFetcherModule.voeFetcherService,
      notificationProcessorModule.notificationQueueService,
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
