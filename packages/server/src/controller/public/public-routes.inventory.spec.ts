import { METHOD_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { AppModule } from 'src/app.module';
import { SKIP_PUBLIC_MASK_METADATA } from 'src/provider/public-mask/public-mask.decorators';
import { isPublicOutputController } from 'src/provider/public-mask/public-output.interceptor';

// Mirrors RESPONSE_PASSTHROUGH_METADATA from @nestjs/common/constants.
const RESPONSE_PASSTHROUGH_METADATA = '__responsePassthrough__';
const ROUTE_ARGS_METADATA = '__routeArguments__';
// RouteParamtypes.RESPONSE from @nestjs/common/enums/route-paramtypes.enum.
const RESPONSE_PARAM_TYPE = 1;

const getControllers = (): any[] =>
  Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, AppModule) || [];

const getRouteHandlers = (controllerClass: any) =>
  Object.getOwnPropertyNames(controllerClass.prototype)
    .filter((name) => name !== 'constructor')
    .map((name) => ({ name, handler: controllerClass.prototype[name] }))
    .filter(
      ({ handler }) =>
        typeof handler === 'function' &&
        Reflect.getMetadata(PATH_METADATA, handler) !== undefined &&
        Reflect.getMetadata(METHOD_METADATA, handler) !== undefined,
    );

const usesRawResponse = (controllerClass: any, methodName: string) => {
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, controllerClass, methodName) || {};
  const injectsResponse = Object.keys(args).some((key) =>
    key.startsWith(`${RESPONSE_PARAM_TYPE}:`),
  );
  if (!injectsResponse) {
    return false;
  }
  return !Reflect.getMetadata(RESPONSE_PASSTHROUGH_METADATA, controllerClass, methodName);
};

describe('public route inventory', () => {
  const publicControllers = getControllers().filter((controller) =>
    isPublicOutputController(controller),
  );

  it('finds the public controllers registered in AppModule', () => {
    expect(publicControllers.map((controller) => controller.name).sort()).toEqual(
      expect.arrayContaining([
        'DiagramController',
        'NavController',
        'PublicController',
        'PublicMomentController',
      ]),
    );
    // Guards against the metadata lookup silently finding nothing.
    expect(
      publicControllers.flatMap((controller) => getRouteHandlers(controller)).length,
    ).toBeGreaterThan(30);
  });

  it('keeps every public handler behind the output interceptor', () => {
    // A handler that writes to the raw response bypasses interceptors, so its output
    // would skip masking. Only explicitly skipped echo endpoints may do that.
    const offenders: string[] = [];
    for (const controller of publicControllers) {
      const controllerSkipped = Reflect.getMetadata(SKIP_PUBLIC_MASK_METADATA, controller);
      for (const { name, handler } of getRouteHandlers(controller)) {
        const skipped =
          controllerSkipped || Reflect.getMetadata(SKIP_PUBLIC_MASK_METADATA, handler);
        if (!skipped && usesRawResponse(controller, name)) {
          offenders.push(`${controller.name}.${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('only skips masking for the diagram echo endpoint', () => {
    const skipped = publicControllers
      .filter((controller) => Reflect.getMetadata(SKIP_PUBLIC_MASK_METADATA, controller))
      .map((controller) => controller.name);
    const skippedHandlers = publicControllers.flatMap((controller) =>
      getRouteHandlers(controller)
        .filter(({ handler }) => Reflect.getMetadata(SKIP_PUBLIC_MASK_METADATA, handler))
        .map(({ name }) => `${controller.name}.${name}`),
    );
    expect(skipped).toEqual(['DiagramController']);
    expect(skippedHandlers).toEqual([]);
  });
});
