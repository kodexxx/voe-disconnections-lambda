import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { createCachedModule } from '../common/utils/module-cache.util';

/**
 * Get or create singleton DynamoDB client
 * Benefits:
 * - Reuses HTTP connection pool on warm Lambda invocations
 * - Reduces cold start time by ~300-500ms per additional client
 * - Improves warm invocation time by ~50-100ms
 */
export const getDynamoDBClient = createCachedModule('dynamoDBClient', () => {
  return new DynamoDBClient({
    maxAttempts: 3,
    requestHandler: {
      connectionTimeout: 2000,
      requestTimeout: 5000,
    },
  });
});
