import { DisconnectionService } from './disconnection.service';
import { DisconnectionsRepository } from './disconnections.repository';
import { DisconnectionsController } from './disconnections.controller';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { Config } from '../config';
import { getVoeFetcherModule } from '../voe-fetcher/voe-fetcher.module';

export const getDisconnectionsModule = () => {
  const voeFetcherModule = getVoeFetcherModule();
  const disconnectionsRepository = new DisconnectionsRepository(
    new DynamoDBClient(),
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
};
