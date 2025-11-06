import { UpdateProcessorService } from './update-processor.service';
import { UpdateQueueMessage } from '../queue-manager/interfaces/update-queue-message.interface';

export class UpdateProcessorController {
  constructor(
    private readonly updateProcessorService: UpdateProcessorService,
  ) {}

  async processUpdate(message: UpdateQueueMessage) {
    return this.updateProcessorService.processUpdate(message);
  }
}
