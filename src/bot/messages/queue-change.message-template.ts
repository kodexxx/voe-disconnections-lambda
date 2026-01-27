import { toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';
import { uk } from 'date-fns/locale';
import { tgFormat } from '../utils/bot.utils';

/**
 * Template for queue change notification message
 */
export function queueChangeMessageTemplate(
  alias: string,
  oldQueueName: string,
  newQueueName: string,
  lastUpdatedAt: string,
): string {
  const timeZone = 'Europe/Kyiv';

  // Format update time
  let updateTimeText = '';
  try {
    const lastUpdateDate = new Date(lastUpdatedAt);

    if (!isNaN(lastUpdateDate.getTime())) {
      const zonedUpdateTime = toZonedTime(lastUpdateDate, timeZone);
      const formattedUpdateTime = format(zonedUpdateTime, "d MMMM 'о' HH:mm", {
        locale: uk,
      });
      updateTimeText = `\n\n${tgFormat.italic(`🕐 Оновлено: ${formattedUpdateTime}`)}`;
    }
  } catch (error) {
    console.error('Error formatting lastUpdatedAt:', error);
  }

  // Footer with links
  const footer = `\n\n━━━━━━━━━━━━━━━━\n📱 [Перейти до бота](https://t.me/voeDisconnectionRobot)\n💬 [Приєднатись до чату](https://t.me/+GkKa3Ws_x1M5ZGI6)`;

  return `⚠️ ${tgFormat.bold('Увага\\! Зміна черги')}\n\n📍 ${tgFormat.bold(alias)}\n\n🔄 Ваша черга змінилась:\n${tgFormat.inlineCode(oldQueueName)} ➡️ ${tgFormat.inlineCode(newQueueName)}${updateTimeText}${footer}`;
}
