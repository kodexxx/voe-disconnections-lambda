import {
  AttributeValue,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import { BotDynamoOptions } from './interfaces/bot-dynamodb.interface';
import { TelegramUserItemInterface } from './interfaces/telegram-user-item.interface';

export class BotRepository {
  constructor(
    private readonly dynamoDBClient: DynamoDBClient,
    private readonly options: BotDynamoOptions,
  ) {}

  async getUser(userId: number) {
    const cmd = new GetItemCommand({
      TableName: this.options.tableName,
      Key: {
        userId: {
          N: userId.toString(),
        },
      },
    });
    const item = await this.dynamoDBClient.send(cmd);
    return this.map(item.Item);
  }

  async upsertUser(userId: number, data: Partial<TelegramUserItemInterface>) {
    const getCmd = new GetItemCommand({
      TableName: this.options.tableName,
      Key: {
        userId: {
          N: userId.toString(),
        },
      },
    });
    const existItem = await this.dynamoDBClient.send(getCmd);
    const newItem = {
      ...existItem.Item,
      userId: {
        N: userId.toString(),
      },
      ...(data.data && {
        data: {
          S: JSON.stringify(data.data),
        },
      }),
      ...(data.subscriptionArgs && {
        subscriptionArgs: {
          S: data.subscriptionArgs,
        },
      }),
      ...(data.state && {
        state: {
          S: JSON.stringify(data.state),
        },
      }),
    };
    const cmd = new PutItemCommand({
      TableName: this.options.tableName,
      Item: newItem,
    });
    return this.dynamoDBClient.send(cmd);
  }

  async getUsersWithSubscription(subscriptionArgs: string) {
    const cmd = new ScanCommand({
      TableName: this.options.tableName,
      FilterExpression: 'subscriptionArgs = :value',
      ExpressionAttributeValues: {
        ':value': { S: subscriptionArgs },
      },
    });
    const result = await this.dynamoDBClient.send(cmd);

    return result.Items.map((item) => this.map(item));
  }

  private map(item: Record<string, AttributeValue>): TelegramUserItemInterface {
    if (!item) {
      return;
    }
    return {
      userId: item?.userId && Number(item.userId.N),
      data: item?.data && JSON.parse(item.data.S),
      subscriptionArgs: item?.subscriptionArgs && item.subscriptionArgs.S,
      state: item?.state && JSON.parse(item.state.S),
    };
  }
}
