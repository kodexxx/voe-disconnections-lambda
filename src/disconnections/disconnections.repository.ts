import {
  DynamoDBClient,
  GetItemCommand,
  AttributeValue,
  PutItemCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import {
  VoeDisconnectionEntity,
  VoeDisconnectionValueItem,
} from './interfaces/disconnections-item.interface';
import { DisconnectionsOptionsInterface } from './interfaces/disconnections-options.interface';
import { getSubscriptionArgs } from './utils/args.utils';

export class DisconnectionsRepository {
  constructor(
    private readonly client: DynamoDBClient,
    private readonly options: DisconnectionsOptionsInterface,
  ) {}

  async findOne(
    cityId: string,
    streetId: string,
    houseId: string,
  ): Promise<VoeDisconnectionEntity> {
    const cmd = new GetItemCommand({
      TableName: this.options.tableName,
      Key: {
        args: {
          S: getSubscriptionArgs(cityId, streetId, houseId),
        },
      },
    });

    const v = await this.client.send(cmd);
    if (v.Item) {
      return this.map(v.Item);
    }
  }

  async findMany(): Promise<VoeDisconnectionEntity[]> {
    const cmd = new ScanCommand({
      TableName: this.options.tableName,
    });

    const items = await this.client.send(cmd);

    return items.Items.map((i) => this.map(i));
  }

  async updateOne(
    cityId: string,
    streetId: string,
    houseId: string,
    update: Partial<VoeDisconnectionEntity>,
  ) {
    const updateCmd = new PutItemCommand({
      TableName: this.options.tableName,

      Item: {
        args: {
          S: getSubscriptionArgs(cityId, streetId, houseId),
        },
        ...(update.alias && {
          alias: {
            S: update.alias,
          },
        }),
        ...(update.value && {
          value: {
            S: JSON.stringify(update.value),
          },
        }),
        lastUpdatedAt: {
          S: new Date().toISOString(),
        },
      },
    });
    await this.client.send(updateCmd);
  }

  private map(item: Record<string, AttributeValue>): VoeDisconnectionEntity {
    const value: VoeDisconnectionValueItem[] = JSON.parse(item.value.S);

    return {
      args: item.args.S,
      alias: item.alias.S,
      lastUpdatedAt: item.lastUpdatedAt?.S,
      value: value.map((v) => ({
        ...v,
        from: new Date(v.from),
        to: new Date(v.to),
      })),
    };
  }
}
