import { VoeFetcherService } from './voe-fetcher.service';

export const getVoeFetcherModule = () => {
  const voeFetcherService = new VoeFetcherService();

  return {
    voeFetcherService,
  };
};
