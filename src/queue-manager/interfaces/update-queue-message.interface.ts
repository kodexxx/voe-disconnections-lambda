export interface UpdateQueueMessage {
  subscriptionArgs: string;
  userIds: number[];
  attempt?: number;
  enqueuedAt?: string;
  originalError?: string;
}
