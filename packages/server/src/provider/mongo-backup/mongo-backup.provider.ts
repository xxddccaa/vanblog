import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class MongoBackupProvider {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async exportAllCollections(): Promise<Record<string, any[]>> {
    const collectionNames = Object.keys(this.connection.collections)
      .filter((name) => !name.startsWith('system.'))
      .sort((a, b) => a.localeCompare(b));

    const entries = await Promise.all(
      collectionNames.map(async (name) => {
        const documents = await this.connection.collections[name].find({}).toArray();
        return [name, documents] as const;
      }),
    );

    return Object.fromEntries(entries);
  }
}
