import { APIGatewayEvent } from 'aws-lambda';
import { getPayload } from '../common/utils/validation.util';
import { GetCalendarQueryDto } from './dto/get-calendar-query.dto';
import { getDisconnectionsModule } from './disconnections.module';

export async function disconnectionCalendar(event: APIGatewayEvent) {
  try {
    const payload = await getPayload(
      event.queryStringParameters,
      GetCalendarQueryDto,
    );
    return await getDisconnectionsModule().disconnectionsController.getDisconnectionsCalendar(
      payload,
    );
  } catch (e) {
    console.error(e);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e }),
      headers: {
        'content-Type': 'application/json',
      },
    };
  }
}

export function prefetch() {
  return getDisconnectionsModule().disconnectionsController.prefetch();
}
