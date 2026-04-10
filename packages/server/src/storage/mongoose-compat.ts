import { Inject } from '@nestjs/common';
import { Document, Model } from './collection-model';
import { StorageModule } from './storage.module';
import { getModelToken, STORAGE_CONNECTION } from './storage.constants';
import { PostgresStoreService as Connection } from './postgres-store.service';

export { Document, Model, Connection };

export const SchemaTypes = {
  Mixed: Object,
};

export const Schema = (_options?: any): ClassDecorator => (target: any) => target;

export const Prop = (_options?: any): PropertyDecorator => () => undefined;

export const SchemaFactory = {
  createForClass(target: any) {
    return {
      target,
      index(..._args: any[]) {
        return undefined;
      },
    };
  },
};

export const InjectModel = (model: string | { name: string }) =>
  Inject(getModelToken(typeof model === 'string' ? model : model.name));

export const InjectConnection = () => Inject(STORAGE_CONNECTION);

export class MongooseModule {
  static forRoot(..._args: any[]) {
    return StorageModule.forRoot();
  }

  static forFeature(models: Array<{ name: string; schema?: any }>) {
    return StorageModule.forFeature(models);
  }
}
