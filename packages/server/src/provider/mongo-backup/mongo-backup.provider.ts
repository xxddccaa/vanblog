import { Injectable } from '@nestjs/common';
import { PostgresStoreService } from 'src/storage/postgres-store.service';

@Injectable()
export class RawCollectionsBackupProvider {
  constructor(private readonly store: PostgresStoreService) {}

  async exportAllCollections(): Promise<Record<string, any[]>> {
    return await this.store.exportAllCollections();
  }
}

export { RawCollectionsBackupProvider as MongoBackupProvider };
