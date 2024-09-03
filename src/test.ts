import 'reflect-metadata';
import { getVoeFetcherModule } from './voe-fetcher/voe-fetcher.module';

const test = () => {
  return getVoeFetcherModule().voeFetcherService.getDisconnections(
    '510100000',
    '1294',
    '33672',
  );
};
test()
  .then(console.log)
  .catch((err) => {
    console.error(err);
  });
