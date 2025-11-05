import * as process from 'node:process';

export const Config = {
  DYNAMODB_TABLE: process.env.DYNAMODB_TABLE,
  TELEGRAM_USERS_TABLE: process.env.TELEGRAM_USERS_TABLE,
  GRAMMY_STATE_TABLE: process.env.GRAMMY_STATE_TABLE,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  UPDATE_QUEUE_URL: process.env.UPDATE_QUEUE_URL,
  NOTIFICATION_QUEUE_URL: process.env.NOTIFICATION_QUEUE_URL,
} as const;
