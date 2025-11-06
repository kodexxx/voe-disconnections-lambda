import { BotService } from './bot.service';
import { BotController } from './bot.controller';
import { Bot } from 'grammy';
import { Config } from '../config';
import { getAwsModule } from '../aws/aws.module';
import { BotRepository } from './bot.repository';
import { GrammyStateRepository } from './grammy-state.repository';
import { DynamodbStorageAdapter } from './adapters/dynamodb-storage.adapter';
import { getVoeFetcherModule } from '../voe-fetcher/voe-fetcher.module';
import { getDisconnectionsModule } from '../disconnections/disconnections.module';
import { createCachedModule } from '../common/utils/module-cache.util';

export const getBotModule = createCachedModule('bot', () => {
  const voeFetcherModule = getVoeFetcherModule();
  const disconnectionsModule = getDisconnectionsModule();
  const awsModule = getAwsModule();

  const botRepository = new BotRepository(awsModule.dynamoDBClient, {
    tableName: Config.TELEGRAM_USERS_TABLE,
  });
  const grammyStateRepository = new GrammyStateRepository(
    awsModule.dynamoDBClient,
    {
      tableName: Config.GRAMMY_STATE_TABLE,
    },
  );
  const dynamodbStorageAdapter = new DynamodbStorageAdapter<any>(
    grammyStateRepository,
  );

  const botService = new BotService(
    new Bot(Config.TELEGRAM_BOT_TOKEN),
    botRepository,
    dynamodbStorageAdapter,
    voeFetcherModule.voeFetcherService,
    disconnectionsModule.disconnectionService,
  );
  const botController = new BotController(botService);

  return { botController, botService };
});
