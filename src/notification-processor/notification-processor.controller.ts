import { NotificationProcessorService } from './notification-processor.service';
import {
  NotificationQueueMessage,
  UpdateNotificationMessage,
  BroadcastNotificationMessage,
} from './interfaces/notification-queue-message.interface';

export class NotificationProcessorController {
  constructor(
    private readonly notificationProcessorService: NotificationProcessorService,
  ) {}

  async processNotification(
    message: NotificationQueueMessage &
      (UpdateNotificationMessage | BroadcastNotificationMessage),
  ) {
    return this.notificationProcessorService.processNotification(message);
  }
}
