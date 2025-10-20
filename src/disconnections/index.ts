import { APIGatewayProxyHandler } from 'aws-lambda';
import { getPayload } from '../common/utils/validation.util';
import { GetCalendarQueryDto } from './dto/get-calendar-query.dto';
import { getDisconnectionsModule } from './disconnections.module';

export const disconnectionCalendar: APIGatewayProxyHandler = async (
  event,
  context,
) => {
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
      body: JSON.stringify({ error: e?.message ?? e }),
      headers: {
        'content-Type': 'application/json',
      },
    };
  }
};
