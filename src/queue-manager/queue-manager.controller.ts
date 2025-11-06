import { QueueManagerService } from './queue-manager.service';

export class QueueManagerController {
  constructor(private readonly queueManagerService: QueueManagerService) {}

  async enqueueAllUpdates() {
    return this.queueManagerService.enqueueAllUpdates();
  }
}
