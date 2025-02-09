import * as process from 'node:process';

export namespace Config {
  export const DYNAMODB_TABLE = process.env.DYNAMODB_TABLE;
  export const TELEGRAM_USERS_TABLE = process.env.TELEGRAM_USERS_TABLE;
  export const GRAMMY_STATE_TABLE = process.env.GRAMMY_STATE_TABLE;
  export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
}
