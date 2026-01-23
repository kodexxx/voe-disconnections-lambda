import { VoeDisconnectionValueItem } from '../../disconnections/interfaces/disconnections-item.interface';

/**
 * Base notification message for the queue
 */
export interface NotificationQueueMessage {
  userId: number;
  attempt?: number;
  enqueuedAt?: string;
  originalError?: string;
}

/**
 * Update notification with disconnection schedule
 */
export interface UpdateNotificationMessage extends NotificationQueueMessage {
  type: 'update';
  data: VoeDisconnectionValueItem[];
  alias: string;
  lastUpdatedAt: string;
  subscriptionArgs: string; // Для логування та аналітики
}

/**
 * Broadcast notification with custom message
 */
export interface BroadcastNotificationMessage extends NotificationQueueMessage {
  type: 'broadcast';
  message: string;
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
}
