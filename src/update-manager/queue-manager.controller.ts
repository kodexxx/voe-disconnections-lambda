import { QueueManagerService } from './queue-manager';

export class QueueManagerController {
  constructor(private readonly queueManagerService: QueueManagerService) {}

  async enqueueAllUpdates() {
    return this.queueManagerService.enqueueAllUpdates();
  }
}
