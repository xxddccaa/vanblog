import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { createStorageModel } from './collection-model';
import { PostgresStoreService } from './postgres-store.service';
import { getModelToken, STORAGE_CONNECTION } from './storage.constants';
import { StructuredDataService } from './structured-data.service';
import { getCollectionName } from './storage.utils';

@Global()
@Module({
  providers: [
    PostgresStoreService,
    StructuredDataService,
    {
      provide: STORAGE_CONNECTION,
      useExisting: PostgresStoreService,
    },
  ],
  exports: [PostgresStoreService, StructuredDataService, STORAGE_CONNECTION],
})
export class StorageModule {
  static forRoot(): DynamicModule {
    return {
      module: StorageModule,
      global: true,
    };
  }

  static forFeature(models: Array<{ name: string; schema?: any }>): DynamicModule {
    const providers: Provider[] = models.map((model) => ({
      provide: getModelToken(model.name),
      useFactory: (store: PostgresStoreService) =>
        createStorageModel(getCollectionName(model.name), store),
      inject: [PostgresStoreService],
    }));

    return {
      module: StorageModule,
      providers,
      exports: providers,
    };
  }
}
