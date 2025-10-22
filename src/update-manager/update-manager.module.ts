import { UpdateManagerService } from './update-manager.service';
import { getDisconnectionsModule } from '../disconnections/disconnections.module';
import { getVoeFetcherModule } from '../voe-fetcher/voe-fetcher.module';
import { getBotModule } from '../bot/bot.module';
import { UpdateManagerController } from './update-manager.controller';
import { createCachedModule } from '../common/utils/module-cache.util';

export const getUpdateManagerModule = createCachedModule(
  'updateManager',
  () => {
    const disconnectionsModule = getDisconnectionsModule();
    const voeFetcherModule = getVoeFetcherModule();
    const botModule = getBotModule();

    const updateManagerService = new UpdateManagerService(
      disconnectionsModule.disconnectionService,
      voeFetcherModule.voeFetcherService,
      botModule.botService,
    );
    const updateManagerController = new UpdateManagerController(
      updateManagerService,
    );
    return {
      updateManagerController,
    };
  },
);
