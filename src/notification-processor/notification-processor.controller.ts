import { NotificationProcessorService } from './notification-processor.service';
import { NotificationQueueMessage } from './interfaces/notification-queue-message.interface';

export class NotificationProcessorController {
  constructor(
    private readonly notificationProcessorService: NotificationProcessorService,
  ) {}

  async processNotification(message: NotificationQueueMessage) {
    return this.notificationProcessorService.processNotification(message);
  }
}
