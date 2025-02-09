import { VoeDisconnectionValueItem } from '../../disconnections/interfaces/disconnections-item.interface';
import { toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { tgEscape, tgFormat } from '../utils/bot.utils';

export function disconnectionMessageTemplate(
  data: VoeDisconnectionValueItem[],
  alias: string,
) {
  const formated = data.reduce((accum, item) => {
    const timeZone = 'Europe/Kyiv';
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
  if (!items.length) {
    return `*${tgEscape('Відключення відсутні 💡!')}*`;
  }
  return `🔔 *${tgEscape('Оновлення графіка відключень!')}*\n${items.join('\n\n\n')}\n\n${tgFormat.italic(alias)}`;
}
