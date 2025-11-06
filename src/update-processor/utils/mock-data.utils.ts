import { VoeDisconnectionValueItem } from '../../disconnections/interfaces/disconnections-item.interface';

export const MOCK_SUBSCRIPTION_ARGS = 'demo-subscription';

export function getMockDisconnections(): VoeDisconnectionValueItem[] {
  const now = Date.now();
  return [
    {
      from: new Date(now + 2 * 60 * 60 * 1000), // +2 години
      to: new Date(now + 6 * 60 * 60 * 1000), // +6 годин
      possibility: 'можливе',
    },
    {
      from: new Date(now + 24 * 60 * 60 * 1000), // +1 день
      to: new Date(now + 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000), // +1 день +4 години
      possibility: 'можливе',
    },
    {
      from: new Date(now + 48 * 60 * 60 * 1000), // +2 дні
      to: new Date(now + 48 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000), // +2 дні +3 години
      possibility: 'точне',
    },
  ];
}
