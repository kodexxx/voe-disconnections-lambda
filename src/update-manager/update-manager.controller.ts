import { UpdateManagerService } from './update-manager.service';

export class UpdateManagerController {
  constructor(private readonly updateManagerService: UpdateManagerService) {}
  prefetch() {
    return this.updateManagerService.prefetchDisconnections();
  }
}
