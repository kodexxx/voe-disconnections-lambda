import {VoeDisconnectionValueItem} from "./disconnections-item.interface";

export interface DisconnectionsResultInterface {
  intervals: VoeDisconnectionValueItem[];
  queueName: string;
}
