import * as process from 'node:process';

export const Config = {
  DYNAMODB_TABLE: process.env.DYNAMODB_TABLE,
  TELEGRAM_USERS_TABLE: process.env.TELEGRAM_USERS_TABLE,
  GRAMMY_STATE_TABLE: process.env.GRAMMY_STATE_TABLE,
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
} as const;
