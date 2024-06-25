import { DisconnectionService } from './disconnection.service';
import { getVoeFetcherModule } from '../voe-fetcher/voe-fetcher.module';
import { DisconnectionsRepository } from './disconnections.repository';
import { DisconnectionsController } from './disconnections.controller';

export const getDisconnectionsModule = () => {
  const voeFetcherModule = getVoeFetcherModule();

  const disconnectionsRepository = new DisconnectionsRepository();
  const disconnectionService = new DisconnectionService(
    voeFetcherModule.voeFetcherService,
    disconnectionsRepository,
  );

  const disconnectionsController = new DisconnectionsController(
    disconnectionService,
  );

  return { disconnectionsController, disconnectionService };
};
