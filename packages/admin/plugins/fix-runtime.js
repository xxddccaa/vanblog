import path from 'node:path';

export default (api) => {
  api.addRuntimePluginKey(() => ['request', 'getInitialState', 'initialStateConfig']);

  api.register({
    key: 'addExtraModels',
    fn: () => [
      `${path.join(api.paths.absSrcPath, 'runtime-fix', 'initialStateModel.ts').replace(/\\/g, '/') }#{"namespace":"@@initialState"}`,
    ],
  });
};
