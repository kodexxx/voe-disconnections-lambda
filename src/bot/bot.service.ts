import { Bot, session, webhookCallback, Keyboard, GrammyError } from 'grammy';
import { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { BotRepository } from './bot.repository';
import { VoeDisconnectionValueItem } from '../disconnections/interfaces/disconnections-item.interface';
import { disconnectionMessageTemplate } from './messages/disconnection.message-template';
import { DynamodbStorageAdapter } from './adapters/dynamodb-storage.adapter';
import {
  conversations,
  createConversation,
  ConversationFlavor,
} from '@grammyjs/conversations';
import { VoeFetcherService } from '../voe-fetcher/voe-fetcher.service';
import { getSubscriptionArgs } from '../disconnections/utils/args.utils';
import { DisconnectionService } from '../disconnections/disconnection.service';
import { Menu } from '@grammyjs/menu';
import querystring from 'querystring';
import { MyContext, MyConversation } from './types/conversation.types';
import { VoeLocationItem } from '../voe-fetcher/interfaces/voe-location-item.interface';
import { BOT_MESSAGES, BOT_IDS } from './constants/messages.constants';

export class BotService {
  private readonly mainMenu: Menu;
  private readonly settingsMenu: Menu;
  private readonly keyboard: Keyboard;

  constructor(
    private readonly bot: Bot<MyContext>,
    private readonly botRepository: BotRepository,
    private readonly dynamodbStorageAdapter: DynamodbStorageAdapter<ConversationFlavor>,
    private readonly voeFetcherService: VoeFetcherService,
    private readonly disconnectionService: DisconnectionService,
  ) {
    // Initialize menus and keyboard
    this.settingsMenu = new Menu(BOT_IDS.MENU.SETTINGS)
      .text(BOT_MESSAGES.MENU.SET_SUBSCRIPTION, (ctx) =>
        ctx.reply(BOT_MESSAGES.MENU.SET_SUBSCRIPTION),
      )
      .row()
      .back(BOT_MESSAGES.MENU.BACK);

    this.mainMenu = new Menu(BOT_IDS.MENU.MAIN).submenu(
      BOT_MESSAGES.MENU.SETTINGS,
      BOT_IDS.MENU.SETTINGS,
    );

    this.mainMenu.register(this.settingsMenu);

    this.keyboard = new Keyboard()
      .text(BOT_MESSAGES.BUTTONS.SETTINGS)
      .row()
      .text(BOT_MESSAGES.BUTTONS.SCHEDULE)
      .row()
      .resized()
      .persistent();

    // Setup bot middleware and handlers
    this.bot.use(
      session({
        storage: this.dynamodbStorageAdapter,
        initial() {
          return {};
        },
      }),
    );
    this.bot.use(conversations());
    this.bot.use(
      createConversation(
        this.subscriptionSetupConversation.bind(this),
        BOT_IDS.CONVERSATION.SUBSCRIPTION_SETUP,
      ),
    );
    this.bot.use(this.mainMenu);

    this.bot.use(async (ctx, next) => {
      console.log('start update user');
      await this.botRepository.upsertUser(ctx.from.id, { data: ctx.from });
      console.log('finish update user');
      await next();
    });
    this.bot.command('kokos', async (ctx) => {
      await ctx.conversation.enter(BOT_IDS.CONVERSATION.SUBSCRIPTION_SETUP);
    });
    this.bot.command('start', async (ctx) => {
      console.log('command start');
      if (!ctx.match) {
        return ctx.reply(BOT_MESSAGES.START.WELCOME, {
          parse_mode: 'Markdown',
          reply_markup: this.keyboard,
        });
      }
      return ctx.reply(BOT_MESSAGES.START.SUBSCRIPTION_ADDED, {
        parse_mode: 'Markdown',
      });
    });
    this.bot.hears(BOT_MESSAGES.BUTTONS.SCHEDULE, async (ctx) => {
      const user = await this.botRepository.getUser(ctx.from.id);
      if (!user.subscriptionArgs) {
        return ctx.reply(BOT_MESSAGES.SUBSCRIPTION.NO_ACTIVE, {
          parse_mode: 'Markdown',
        });
      }
      const { cityId, streetId, houseId } = querystring.parse(
        user.subscriptionArgs,
      );
      const data = await this.disconnectionService.getDisconnectionsSchedule(
        cityId.toString(),
        streetId.toString(),
        houseId.toString(),
      );
      if (!data) {
        return ctx.reply(BOT_MESSAGES.SCHEDULE.NOT_FORMED, {
          parse_mode: 'Markdown',
        });
      }
      await ctx.reply(
        disconnectionMessageTemplate(
          data.value,
          data.alias,
          data.lastUpdatedAt,
        ),
        {
          parse_mode: 'MarkdownV2',
        },
      );
    });
    this.bot.hears(BOT_MESSAGES.BUTTONS.SETTINGS, (ctx) =>
      ctx.conversation.enter(BOT_IDS.CONVERSATION.SUBSCRIPTION_SETUP),
    );

    this.bot.on('message', async (ctx) => {
      return ctx.reply(BOT_MESSAGES.START.WELCOME, {
        parse_mode: 'Markdown',
        reply_markup: this.keyboard,
      });
    });
  }

  async handleWebhook(event: APIGatewayProxyEventV2, context?: Context) {
    const cb = webhookCallback(this.bot, 'aws-lambda-async');
    try {
      return await cb(event, context);
    } catch (e) {
      if (e.error instanceof GrammyError && e.error.error_code === 403) {
        console.warn(`User has blocked the bot - ignore`, event);
        // DON'T throw error - remove from queue
        // TODO: Optionally - remove user's subscription from DB
        return {
          statusCode: 200,
        };
      } else if (e.error instanceof GrammyError && e.error.error_code === 400) {
        console.error(
          `Invalid message format for user`,
          e.error.description,
          event,
        );
        // DON'T throw error - data issue, not API issue
        return {
          statusCode: 200,
        };
      } else if (e.error instanceof GrammyError && e.error.error_code === 429) {
        console.warn(`Rate limit hit for user`, event);
        throw e;
      }

      console.error('Failed to process webhook', e, event);
      throw e;
    }
  }

  async handleBroadcast(event: any) {
    try {
      // Підтримка як API Gateway формату, так і прямого виклику
      const data = event.body ? JSON.parse(event.body) : event;
      const { message, parseMode = 'Markdown' } = data;

      if (!message) {
        return {
          success: false,
          error: BOT_MESSAGES.BROADCAST.MESSAGE_REQUIRED,
          usage: {
            message: BOT_MESSAGES.BROADCAST.USAGE_MESSAGE,
            parseMode: BOT_MESSAGES.BROADCAST.USAGE_PARSE_MODE,
          },
        };
      }

      const result = await this.broadcastMessage(message, parseMode);

      return {
        success: true,
        message: BOT_MESSAGES.BROADCAST.COMPLETED,
        statistics: result,
      };
    } catch (error) {
      console.error('Broadcast error:', error);
      return {
        success: false,
        error: BOT_MESSAGES.BROADCAST.ERROR,
        details: error.message,
      };
    }
  }

  async notifyWithUpdate(
    args: string,
    data: VoeDisconnectionValueItem[],
    alias: string,
    lastUpdatedAt?: string,
  ) {
    const usersToNotify =
      await this.botRepository.getUsersWithSubscription(args);

    const promises = usersToNotify.map(async (u) => {
      try {
        await this.bot.api.sendMessage(
          u.userId,
          disconnectionMessageTemplate(data, alias, lastUpdatedAt),
          { parse_mode: 'MarkdownV2' },
        );
      } catch (e) {
        console.error(e);
      }
    });

    return await Promise.all(promises);
  }

  notifyUserWithUpdate(
    userId: number,
    data: VoeDisconnectionValueItem[],
    alias: string,
    lastUpdatedAt?: string,
  ) {
    return this.bot.api.sendMessage(
      userId,
      disconnectionMessageTemplate(data, alias, lastUpdatedAt),
      { parse_mode: 'MarkdownV2' },
    );
  }

  async getAllUsersWithSubscriptions() {
    return this.botRepository.getAllUsersWithSubscriptions();
  }

  async broadcastMessage(
    message: string,
    parseMode: 'Markdown' | 'MarkdownV2' | 'HTML' = 'Markdown',
  ) {
    const allUsers = await this.botRepository.getAllUsers();

    let successCount = 0;
    let failedCount = 0;
    const failedUsers = [];

    const promises = allUsers.map(async (user) => {
      try {
        await this.bot.api.sendMessage(user.userId, message, {
          parse_mode: parseMode,
        });
        successCount++;
      } catch (e) {
        failedCount++;
        failedUsers.push(user.userId);

        // Log the error for debugging purposes
        if (e.error_code === 403) {
          console.log(`User ${user.userId} has blocked the bot`);
        } else if (e.error_code === 400) {
          console.error(
            `Invalid message format for user ${user.userId}:`,
            e.description,
          );
        } else {
          console.error(`Failed to send message to user ${user.userId}:`, e);
        }
      }
    });

    await Promise.all(promises);

    return {
      success: successCount,
      failed: failedCount,
      failedUsers,
      total: allUsers.length,
    };
  }

  private async waitForTextWithCancel(
    conversation: MyConversation,
    ctx: MyContext,
    message: string,
  ): Promise<string | null> {
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: BOT_MESSAGES.BUTTONS.CANCEL,
              callback_data: BOT_IDS.CALLBACK.CANCEL,
            },
          ],
        ],
      },
    });

    const response = await conversation.wait();

    // Перевіряємо, чи це callback від кнопки скасування
    if (response.callbackQuery?.data === BOT_IDS.CALLBACK.CANCEL) {
      await response.answerCallbackQuery();
      await ctx.reply(BOT_MESSAGES.SUBSCRIPTION.CANCELLED, {
        parse_mode: 'Markdown',
        reply_markup: this.keyboard,
      });
      return null;
    }

    return response.message?.text;
  }

  private async waitForSelectionWithCancel(
    conversation: MyConversation,
    ctx: MyContext,
    items: VoeLocationItem[],
    callbackPrefix: string,
    message: string,
  ): Promise<VoeLocationItem | null> {
    const buttons = items.slice(0, 8).map((item, index) => [
      {
        text: item.name,
        callback_data: `${callbackPrefix}=${index}`,
      },
    ]);
    buttons.push([
      {
        text: BOT_MESSAGES.BUTTONS.CANCEL,
        callback_data: BOT_IDS.CALLBACK.CANCEL,
      },
    ]);

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: buttons,
      },
    });

    const callback = await conversation.waitForCallbackQuery(
      new RegExp(`${callbackPrefix}=(.*)|(${BOT_IDS.CALLBACK.CANCEL})`),
    );

    await callback.answerCallbackQuery();

    if (callback.match[0] === BOT_IDS.CALLBACK.CANCEL) {
      await ctx.reply(BOT_MESSAGES.SUBSCRIPTION.CANCELLED, {
        parse_mode: 'Markdown',
        reply_markup: this.keyboard,
      });
      return null;
    }

    return items[callback.match[1]];
  }

  async subscriptionSetupConversation(
    conversation: MyConversation,
    ctx: MyContext,
  ) {
    await ctx.reply(BOT_MESSAGES.SUBSCRIPTION.SETUP_INTRO, {
      parse_mode: 'Markdown',
      reply_markup: {
        remove_keyboard: true,
      },
    });

    // Крок 1: Введення та вибір міста
    const city = await this.waitForTextWithCancel(
      conversation,
      ctx,
      BOT_MESSAGES.SUBSCRIPTION.ENTER_CITY,
    );
    if (!city) return;

    let cityData: { id: string; name: string }[] | undefined;
    try {
      cityData = await conversation.external(() =>
        this.voeFetcherService.getCityByName(city),
      );
    } catch (error) {
      console.error('Error fetching cities:', error);
      await ctx.reply(BOT_MESSAGES.ERROR.API_UNAVAILABLE, {
        parse_mode: 'Markdown',
        reply_markup: this.keyboard,
      });
      return;
    }

    if (!cityData?.length) {
      await ctx.reply(BOT_MESSAGES.SUBSCRIPTION.CITY_NOT_FOUND, {
        parse_mode: 'Markdown',
        reply_markup: this.keyboard,
      });
      return;
    }

    const selectedCity = await this.waitForSelectionWithCancel(
      conversation,
      ctx,
      cityData,
      BOT_IDS.CALLBACK.SET_CITY,
      BOT_MESSAGES.SUBSCRIPTION.CITIES_FOUND,
    );
    if (!selectedCity) return;

    // Крок 2: Введення та вибір вулиці
    const street = await this.waitForTextWithCancel(
      conversation,
      ctx,
      BOT_MESSAGES.SUBSCRIPTION.ENTER_STREET,
    );
    if (!street) return;

    let streetData: { id: string; name: string }[] | undefined;
    try {
      streetData = await conversation.external(() =>
        this.voeFetcherService.getStreetByName(selectedCity.id, street),
      );
    } catch (error) {
      console.error('Error fetching streets:', error);
      await ctx.reply(BOT_MESSAGES.ERROR.API_UNAVAILABLE, {
        parse_mode: 'Markdown',
        reply_markup: this.keyboard,
      });
      return;
    }

    if (!streetData?.length) {
      await ctx.reply(BOT_MESSAGES.SUBSCRIPTION.STREETS_NOT_FOUND, {
        parse_mode: 'Markdown',
        reply_markup: this.keyboard,
      });
      return;
    }

    const selectedStreet = await this.waitForSelectionWithCancel(
      conversation,
      ctx,
      streetData,
      BOT_IDS.CALLBACK.SET_STREET,
      BOT_MESSAGES.SUBSCRIPTION.STREETS_FOUND,
    );
    if (!selectedStreet) return;

    // Крок 3: Введення та вибір будинку
    const house = await this.waitForTextWithCancel(
      conversation,
      ctx,
      BOT_MESSAGES.SUBSCRIPTION.ENTER_HOUSE,
    );
    if (!house) return;

    let houseData: { id: string; name: string }[] | undefined;
    try {
      houseData = await conversation.external(() =>
        this.voeFetcherService.getHouseByName(selectedStreet.id, house),
      );
    } catch (error) {
      console.error('Error fetching houses:', error);
      await ctx.reply(BOT_MESSAGES.ERROR.API_UNAVAILABLE, {
        parse_mode: 'Markdown',
        reply_markup: this.keyboard,
      });
      return;
    }

    if (!houseData?.length) {
      await ctx.reply(BOT_MESSAGES.SUBSCRIPTION.HOUSES_NOT_FOUND, {
        parse_mode: 'Markdown',
        reply_markup: this.keyboard,
      });
      return;
    }

    const selectedHouse = await this.waitForSelectionWithCancel(
      conversation,
      ctx,
      houseData,
      BOT_IDS.CALLBACK.SET_HOUSE,
      BOT_MESSAGES.SUBSCRIPTION.HOUSES_FOUND,
    );
    if (!selectedHouse) return;

    await this.botRepository.upsertUser(ctx.from.id, {
      subscriptionArgs: getSubscriptionArgs(
        selectedCity.id,
        selectedStreet.id,
        selectedHouse.id,
      ),
    });

    const alias = `${selectedCity.name}, ${selectedStreet.name} ${selectedHouse.name}`;
    const registeredDisconnection = await conversation.external(() =>
      this.disconnectionService.registerDisconnection(
        selectedCity.id,
        selectedStreet.id,
        selectedHouse.id,
        alias,
      ),
    );

    await ctx.reply(
      disconnectionMessageTemplate(
        registeredDisconnection.value,
        registeredDisconnection.alias,
        registeredDisconnection.lastUpdatedAt,
      ),
      {
        parse_mode: 'MarkdownV2',
      },
    );

    await ctx.reply(BOT_MESSAGES.SUBSCRIPTION.SUCCESS, {
      parse_mode: 'Markdown',
      reply_markup: this.keyboard,
    });

    return;
  }
}
