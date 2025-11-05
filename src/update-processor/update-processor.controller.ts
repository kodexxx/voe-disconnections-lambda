import { UpdateProcessorService } from './update-processor.service';
import { UpdateQueueMessage } from '../queue-manager/update-queue.service';

export class UpdateProcessorController {
  constructor(
    private readonly updateProcessorService: UpdateProcessorService,
  ) {}

  async processUpdate(message: UpdateQueueMessage) {
    return this.updateProcessorService.processUpdate(message);
  }
}
