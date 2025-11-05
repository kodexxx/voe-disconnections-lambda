import { UpdateProcessorService } from './update-processor';
import { UpdateQueueMessage } from './update-queue.service';

export class UpdateProcessorController {
  constructor(
    private readonly updateProcessorService: UpdateProcessorService,
  ) {}

  async processUpdate(message: UpdateQueueMessage) {
    return this.updateProcessorService.processUpdate(message);
  }
}
