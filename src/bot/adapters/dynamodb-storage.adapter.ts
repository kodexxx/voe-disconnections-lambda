import { StorageAdapter } from 'grammy/out/convenience/session';
import { GrammyStateRepository } from '../grammy-state.repository';

export class DynamodbStorageAdapter<T> implements StorageAdapter<T> {
  constructor(private readonly grammyStateRepository: GrammyStateRepository) {}
  read(key: string): Promise<T> {
    return this.grammyStateRepository.getState(key);
  }

  async write(key: string, value: T) {
    await this.grammyStateRepository.updateState(key, value);
  }

  async delete(key: string) {
    await this.grammyStateRepository.deleteState(key);
  }
}
