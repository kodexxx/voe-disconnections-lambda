import {
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import { GrammyStorageInterface } from './interfaces/grammy-storage.interface';

export class GrammyStateRepository {
  constructor(
    private readonly dynamoDBClient: DynamoDBClient,
    private readonly options: GrammyStorageInterface,
  ) {}

  async getState<T>(key: string): Promise<T> {
    const cmd = new GetItemCommand({
      TableName: this.options.tableName,
      Key: {
        key: {
          S: key,
        },
      },
    });
    const item = await this.dynamoDBClient.send(cmd);
    return item.Item?.state && JSON.parse(item.Item?.state?.S);
  }

  async updateState<T>(key: string, object: T) {
    const cmd = new PutItemCommand({
      TableName: this.options.tableName,
      Item: {
        key: {
          S: key,
        },
        state: {
          S: JSON.stringify(object),
        },
      },
    });
    await this.dynamoDBClient.send(cmd);
  }

  async deleteState(key: string) {
    const cmd = new DeleteItemCommand({
      TableName: this.options.tableName,
      Key: {
        key: {
          S: key,
        },
      },
    });

    await this.dynamoDBClient.send(cmd);
  }
}
