import { DisconnectionService } from './disconnection.service';
import { DisconnectionsRepository } from './disconnections.repository';
import { DisconnectionsController } from './disconnections.controller';
import { Config } from '../config';
import { getDynamoDBClient } from '../database/database.module';
import { getVoeFetcherModule } from '../voe-fetcher/voe-fetcher.module';
import { createCachedModule } from '../common/utils/module-cache.util';

export const getDisconnectionsModule = createCachedModule(
  'disconnections',
  () => {
    const voeFetcherModule = getVoeFetcherModule();
    const disconnectionsRepository = new DisconnectionsRepository(
      getDynamoDBClient(),
      {
        tableName: Config.DYNAMODB_TABLE,
      },
    );
    const disconnectionService = new DisconnectionService(
      disconnectionsRepository,
      voeFetcherModule.voeFetcherService,
    );

    const disconnectionsController = new DisconnectionsController(
      disconnectionService,
    );

    return { disconnectionsController, disconnectionService };
  },
);
