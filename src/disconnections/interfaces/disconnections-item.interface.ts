export interface VoeDisconnectionValueItem {
  from: Date;
  to: Date;
  possibility: string;
}

export interface VoeDisconnectionEntity {
  args: string;
  alias: string;
  lastUpdatedAt: string;
  value: VoeDisconnectionValueItem[];
}
