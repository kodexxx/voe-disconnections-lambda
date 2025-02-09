import { UpdateManagerService } from './update-manager.service';
import { getDisconnectionsModule } from '../disconnections/disconnections.module';
import { getVoeFetcherModule } from '../voe-fetcher/voe-fetcher.module';
import { getBotModule } from '../bot/bot.module';
import { UpdateManagerController } from './update-manager.controller';

export const getUpdateManagerModule = () => {
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
};
