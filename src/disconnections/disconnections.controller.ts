import { DisconnectionService } from './disconnection.service';
import { GetCalendarQueryDto } from './dto/get-calendar-query.dto';

export class DisconnectionsController {
  constructor(private readonly disconnectionService: DisconnectionService) {}

  async getDisconnectionsCalendar(payload: GetCalendarQueryDto) {
    if (payload.json) {
      return {
        statusCode: 200,
        body: JSON.stringify(
          await this.disconnectionService.getDisconnectionsWithCache(
            payload.cityId,
            payload.streetId,
            payload.houseId,
          ),
        ),
        headers: {
          'content-Type': 'application/json',
        },
      };
    }

    return {
      statusCode: 200,
      body: Buffer.from(
        await this.disconnectionService.getDisconnectionsCalendar(
          payload.cityId,
          payload.streetId,
          payload.houseId,
        ),
      ).toString('base64'),
      isBase64Encoded: true,
      headers: {
        'content-type': 'text/calendar',
        'content-disposition': 'attachment; filename="disconnections.ics',
      },
    };
  }

  prefetch() {
    return this.disconnectionService.prefetchDisconnections();
  }
}
