import { VoeDisconnectionValueItem } from '../../disconnections/interfaces/disconnections-item.interface';

export interface NotificationQueueMessage {
  userId: number;
  data: VoeDisconnectionValueItem[];
  alias: string;
  lastUpdatedAt: string;
  subscriptionArgs: string; // Для логування та аналітики
  attempt?: number;
  enqueuedAt?: string;
  originalError?: string;
}
