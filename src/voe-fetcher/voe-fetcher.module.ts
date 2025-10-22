import { VoeFetcherService } from './voe-fetcher.service';
import { createCachedModule } from '../common/utils/module-cache.util';

export const getVoeFetcherModule = createCachedModule('voeFetcher', () => {
  const voeFetcherService = new VoeFetcherService();

  return {
    voeFetcherService,
  };
});
