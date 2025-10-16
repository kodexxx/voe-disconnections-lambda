import { VoeDisconnectionValueItem } from '../../disconnections/interfaces/disconnections-item.interface';
import { toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { tgEscape, tgFormat } from '../utils/bot.utils';

export function disconnectionMessageTemplate(
  data: VoeDisconnectionValueItem[],
  alias: string,
  lastUpdatedAt?: string,
) {
  const timeZone = 'Europe/Kyiv';

  const formated = data.reduce((accum, item) => {
    const zonedFrom = toZonedTime(item.from, timeZone);
    const zonedTo = toZonedTime(item.to, timeZone);

    const formatedTimeFrom = format(zonedFrom, 'HH:mm');
    const formatedTimeTo = format(zonedTo, 'HH:mm');

    const formattedDate = format(zonedFrom, 'd MMMM', { locale: uk });

    if (!accum.has(formattedDate)) {
      accum.set(formattedDate, []);
    }
    accum.get(formattedDate).push({
      from: formatedTimeFrom,
      to: formatedTimeTo,
      possibility: item.possibility,
    });
    return accum;
  }, new Map());

  const items = Array.from(formated).map(([key, value]) => {
    const title = `📅 ${tgFormat.bold(key)}\n`;
    const items = value
      .map(
        (d) => `\\- 🕛 *${d.from} \\- ${d.to}*  _${tgEscape(d.possibility)}_`,
      )
      .join('\n');
    return [title, items].join('\n');
  });
  // Форматування часу останнього оновлення
  let updateTimeText = '';
  if (lastUpdatedAt) {
    const lastUpdateDate = new Date(lastUpdatedAt);
    const zonedUpdateTime = toZonedTime(lastUpdateDate, timeZone);
    const formattedUpdateTime = format(
      zonedUpdateTime,
      "d MMMM 'о' HH:mm",
      { locale: uk },
    );
    updateTimeText = `\n🕐 ${tgFormat.italic(`Оновлено: ${formattedUpdateTime}`)}`;
  }

  if (!items.length) {
    return `*${tgEscape('Відключення відсутні 💡!')}*\n\n📍 ${tgFormat.bold(tgEscape(alias))}${updateTimeText}`;
  }

  return `🔔 *${tgEscape('Графік відключень')}*\n\n📍 ${tgFormat.bold(tgEscape(alias))}\n\n${items.join('\n\n\n')}${updateTimeText}`;
}
