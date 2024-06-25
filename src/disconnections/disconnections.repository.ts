import {
  DynamoDBClient,
  GetItemCommand,
  AttributeValue,
  PutItemCommand,
  ScanCommand,
} from '@aws-sdk/client-dynamodb';
import querystring from 'querystring';
import {
  VoeDisconnectionEntity,
  VoeDisconnectionValueItem,
} from './interfaces/disconnections-item.interface';

export class DisconnectionsRepository {
  private readonly client = new DynamoDBClient();
  private readonly tableName = 'voe-disconnection';

  async findOne(
    cityId: string,
    streetId: string,
    houseId: string,
  ): Promise<VoeDisconnectionEntity> {
    const cmd = new GetItemCommand({
      TableName: this.tableName,
      Key: {
        args: {
          S: querystring.stringify({ cityId, streetId, houseId }),
        },
      },
    });

    const v = await this.client.send(cmd);
    if (v.Item) {
      return this.map(v.Item);
    }
  }

  async findMany() {
    const cmd = new ScanCommand({
      TableName: this.tableName,
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
      TableName: this.tableName,

      Item: {
        args: {
          S: querystring.stringify({ cityId, streetId, houseId }),
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
      lastUpdatedAt: item.args.S,
      value: value.map((v) => ({
        ...v,
        from: new Date(v.from),
        to: new Date(v.to),
      })),
    };
  }
}
