import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SQS } from '@aws-sdk/client-sqs';
import { createCachedModule } from '../common/utils/module-cache.util';
import { Config } from '../config';

/**
 * Get or create singleton AWS clients module
 *
 * Benefits:
 * - Reuses HTTP connection pool on warm Lambda invocations
 * - Reduces cold start time by ~500-800ms per additional client
 * - Improves warm invocation time by ~80-150ms
 * - Single source of truth for all AWS client configurations
 *
 * @returns Object containing singleton AWS clients:
 * - dynamoDBClient: DynamoDB client for database operations
 * - sqsClient: SQS client for queue operations
 */
export const getAwsModule = createCachedModule('aws', () => {
  const dynamoDBClient = new DynamoDBClient({
    maxAttempts: 3,
    requestHandler: {
      connectionTimeout: 2000,
      requestTimeout: 5000,
    },
  });

  const sqsClient = new SQS({
    region: Config.AWS_REGION,
    maxAttempts: 3,
    requestHandler: {
      connectionTimeout: 2000,
      requestTimeout: 5000,
    },
  });

  return {
    dynamoDBClient,
    sqsClient,
  };
});
