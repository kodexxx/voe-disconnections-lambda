import 'reflect-metadata';
import { getPayload } from './common/utils/validation.util';
import { GetCalendarQueryDto } from './disconnections/dto/get-calendar-query.dto';

const test = async () => {
  // return getDisconnectionsModule()
  //     .disconnectionService
  //     .getDisconnectionsWithCache('510100000', '1294', '33672')
  try {
    await getPayload({ lol: true }, GetCalendarQueryDto);
  } catch (e) {
    console.error(e);
  }
};
test().then(console.log).catch(console.error);
