import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getPayload } from '../common/utils/validation.util';
import { GetCalendarQueryDto } from './dto/get-calendar-query.dto';
import { getDisconnectionsModule } from './disconnections.module';

/**
 * Lambda handler for disconnection calendar HTTP API
 * Returns calendar of disconnections for given parameters
 */
export const handler = async (
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
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
        'content-type': 'application/json',
      },
    };
  }
};
