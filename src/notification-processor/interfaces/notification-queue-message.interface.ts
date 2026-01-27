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
  subscriptionArgs: string;
  queueName: string;
}

/**
 * Queue change notification when user's queue number changes
 */
export interface QueueChangedNotificationMessage
  extends NotificationQueueMessage {
  type: 'queue-change';
  alias: string;
  lastUpdatedAt: string;
  subscriptionArgs: string;
  oldQueueName: string;
  newQueueName: string;
}

/**
 * Broadcast notification with custom message
 */
export interface BroadcastNotificationMessage extends NotificationQueueMessage {
  type: 'broadcast';
  message: string;
  parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
}

/**
 * Union type for all notification messages
 */
export type NotificationMessage =
  | UpdateNotificationMessage
  | QueueChangedNotificationMessage
  | BroadcastNotificationMessage;
