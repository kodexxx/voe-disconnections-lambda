import { NotificationProcessorService } from './notification-processor';
import { NotificationQueueMessage } from './notification-queue.service';

export class NotificationProcessorController {
  constructor(
    private readonly notificationProcessorService: NotificationProcessorService,
  ) {}

  async processNotification(message: NotificationQueueMessage) {
    return this.notificationProcessorService.processNotification(message);
  }
}
