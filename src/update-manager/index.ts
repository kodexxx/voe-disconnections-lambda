import { getUpdateManagerModule } from './update-manager.module';

export function prefetch() {
  return getUpdateManagerModule().updateManagerController.prefetch();
}
