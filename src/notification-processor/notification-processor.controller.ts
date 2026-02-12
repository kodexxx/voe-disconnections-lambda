import { NotificationProcessorService } from './notification-processor.service';
import { NotificationMessage } from './interfaces/notification-queue-message.interface';

export class NotificationProcessorController {
  constructor(
    private readonly notificationProcessorService: NotificationProcessorService,
  ) {}

  async processNotification(message: NotificationMessage) {
    return this.notificationProcessorService.processNotification(message);
  }
}
