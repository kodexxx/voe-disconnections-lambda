import { NotificationMessage } from './notification-queue-message.interface';

/**
 * Strategy for processing a specific notification type.
 * Implement this interface and register in notification-processor.module.ts.
 */
export interface NotificationHandlerStrategy {
  canHandle(message: NotificationMessage): boolean;
  handle(message: NotificationMessage): Promise<void>;
}
