import {Bot, session, webhookCallback, Context as GRContext, Keyboard} from 'grammy';
import { APIGatewayEvent } from 'aws-lambda';
import { Context } from 'aws-lambda';
import { BotRepository } from './bot.repository';
import { VoeDisconnectionValueItem } from '../disconnections/interfaces/disconnections-item.interface';
import { disconnectionMessageTemplate } from './messages/disconnection.message-template';
import { DynamodbStorageAdapter } from './adapters/dynamodb-storage.adapter';
import {
  Conversation,
  ConversationFlavor,
  conversations,
  createConversation,
} from '@grammyjs/conversations';
import { VoeFetcherService } from '../voe-fetcher/voe-fetcher.service';
import { getSubscriptionArgs } from '../disconnections/utils/args.utils';
import { DisconnectionService } from '../disconnections/disconnection.service';
import {Menu} from "@grammyjs/menu";
import querystring from "querystring";

type MyContext = GRContext & ConversationFlavor;
type MyConversation = Conversation<MyContext>;

const mainMenu = new Menu("main-menu")
    .submenu("Налаштування", 'settings-menu').row()
    .text("Поточний розклад", (ctx) => ctx.reply("You pressed B!"));


const settingsMenu = new Menu('settings-menu')
    .text('Встановити підписку', (ctx) => ctx.reply('Встановити підписику')).row()
    .back('Назад');

const SETTINGS_BUTTON = '🛠️ Налаштування';
const SCHEDULE_BUTTON = '🗓️ Поточний розклад';

const keyboard = new Keyboard()
    .text(SETTINGS_BUTTON).row()
    .text(SCHEDULE_BUTTON).row()
    .resized()
    .persistent();


mainMenu.register(settingsMenu);

export class BotService {
  constructor(
    private readonly bot: Bot<MyContext>,
    private readonly botRepository: BotRepository,
    private readonly dynamodbStorageAdapter: DynamodbStorageAdapter<ConversationFlavor>,
    private readonly voeFetcherService: VoeFetcherService,
    private readonly disconnectionService: DisconnectionService,
  ) {
    this.bot.use(
      session({
        storage: this.dynamodbStorageAdapter,
        initial() {
          return {};
        },
      }),
    );
    this.bot.use(conversations());
    this.bot.use(createConversation(this.demoConversation.bind(this), 'demo'));
    this.bot.use(mainMenu)

    this.bot.use(async (ctx, next) => {
      console.log('start update user');
      await this.botRepository.upsertUser(ctx.from.id, { data: ctx.from });
      console.log('finish update user');
      await next();
    });
    this.bot.command('kokos', async (ctx) => {
      await ctx.conversation.enter('demo');
    });
    this.bot.command('start', async (ctx) => {
      console.log('command start');
      if (!ctx.match) {
        return ctx.reply(
          'Розробка боту в процесі! Бот вже тестується і буде запущений найближим часом!',
          {
            reply_markup: keyboard,
          },
        );
      }
      return ctx.reply('Підписка додана!');
    });
    this.bot.hears(SCHEDULE_BUTTON, async (ctx) => {
      const user = await this.botRepository.getUser(ctx.from.id);
      if (!user.subscriptionArgs) {
        return ctx.reply('У вас немає активної підписки, встановіть адресу спочатку у налаштуваннях!');
      }
      const { cityId, streetId, houseId } = querystring.parse(user.subscriptionArgs);
      const data = await this.disconnectionService.getDisconnectionsSchedule(cityId.toString(), streetId.toString(), houseId.toString());
      if (!data) {
        return ctx.reply('На разі розклад ще не софрмований, спробуйте пізніше!');
      }
      await ctx.reply(
          disconnectionMessageTemplate(
              data.value,
              data.alias,
          ),
          {
            parse_mode: 'MarkdownV2',
          },
      );
    });
    this.bot.hears(SETTINGS_BUTTON, (ctx) => ctx.conversation.enter('demo'))

    this.bot.on('message', async (ctx) => {
      return ctx.reply(
        'Розробка боту в процесі! Бот вже тестується і буде запущений найближим часом!',
        {
          reply_markup: keyboard,
        },
      );
    });
  }

  async handleWebhook(event: APIGatewayEvent, context: Context) {
    const cb = webhookCallback(this.bot, 'aws-lambda-async');
    return cb(event, context);
  }

  async notifyWithUpdate(
    args: string,
    data: VoeDisconnectionValueItem[],
    alias: string,
  ) {
    const usersToNotify =
      await this.botRepository.getUsersWithSubscription(args);

    const promises = usersToNotify.map(async (u) => {
      try {
        await this.bot.api.sendMessage(
          u.userId,
          disconnectionMessageTemplate(data, alias),
          { parse_mode: 'MarkdownV2' },
        );
      } catch (e) {
        console.error(e);
      }
    });

    return await Promise.all(promises);
  }

  async demoConversation(conversation: MyConversation, ctx: MyContext) {
    await ctx.reply(
      'Для того щоб встановити підписку потрібно по черзі заповнити, місто, вулицю, та будинок, обираючи при цьому знайдений ваш варіант.',
        {
          reply_markup: {
            remove_keyboard: true,
          }
        }
    );
    await ctx.reply('Введіть місто');
    const city = await conversation.form.text();
    const cityData = await conversation.external(() =>
      this.voeFetcherService.getCityByName(city),
    );
    if (!cityData?.length) {
      await ctx.reply('Місто не знайдено, спробуйте спочатку!');
      return;
    }

    await ctx.reply('Знайдені міста', {
      reply_markup: {
        inline_keyboard: cityData.slice(0, 8).map((v, index) => [
          {
            text: v.name,
            callback_data: `set_city=${index}`,
          },
        ]),
      },
    });

    const cbCity = await conversation.waitForCallbackQuery(/set_city=(.*)/);
    const selectedCity = cityData[cbCity.match[1]];

    await ctx.reply('Введіть вулицю');
    const street = await conversation.form.text();
    const streetData = await conversation.external(() =>
      this.voeFetcherService.getStreetByName(selectedCity.id, street),
    );
    if (!streetData?.length) {
      await ctx.reply('Вулиць не знайдено!');
      return;
    }

    await ctx.reply('Знайдені вулиці', {
      reply_markup: {
        inline_keyboard: streetData.slice(0, 8).map((v, index) => [
          {
            text: v.name,
            callback_data: `set_street=${index}`,
          },
        ]),
      },
    });
    const cbStreet = await conversation.waitForCallbackQuery(/set_street=(.*)/);
    const selectedStreet = streetData[cbStreet.match[1]];

    await ctx.reply('Введіть будинок');
    const house = await conversation.form.text();
    const houseData = await conversation.external(() =>
      this.voeFetcherService.getHouseByName(selectedStreet.id, house),
    );
    if (!houseData?.length) {
      await ctx.reply('Будинків не знайдено!');
      return;
    }

    await ctx.reply('Знайдені будинки', {
      reply_markup: {
        inline_keyboard: houseData.slice(0, 8).map((v, index) => [
          {
            text: v.name,
            callback_data: `set_house=${index}`,
          },
        ]),
      },
    });
    const cbHouse = await conversation.waitForCallbackQuery(/set_house=(.*)/);
    const selectedHouse = houseData[cbHouse.match[1]];

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
      ),
      {
        parse_mode: 'MarkdownV2',
      },
    );

    await ctx.reply(`Підписка оновлена! Тепер ви будете отримувати сповіщення`, {
      reply_markup: keyboard
    });

    return;
  }
}
