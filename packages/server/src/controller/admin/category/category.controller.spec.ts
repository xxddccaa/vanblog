import { CategoryController } from './category.controller';

describe('CategoryController', () => {
  it('does not expose detailed category records to anonymous requests on the public admin route', async () => {
    const categoryProvider = {
      getAllCategories: jest.fn().mockResolvedValue(['Tech', 'Life']),
    };
    const controller = new CategoryController(categoryProvider as any, {} as any);

    const result = await controller.getAllCategory({ user: undefined } as any, 'true');

    expect(categoryProvider.getAllCategories).toHaveBeenCalledWith(false);
    expect(result).toEqual({
      statusCode: 200,
      data: ['Tech', 'Life'],
    });
  });

  it('still allows detailed category records for the admin user', async () => {
    const categoryProvider = {
      getAllCategories: jest.fn().mockResolvedValue([
        { name: 'Private', private: true, password: 'secret' },
      ]),
    };
    const controller = new CategoryController(categoryProvider as any, {} as any);

    const result = await controller.getAllCategory({ user: { id: 0 } } as any, 'true');

    expect(categoryProvider.getAllCategories).toHaveBeenCalledWith(true);
    expect(result).toEqual({
      statusCode: 200,
      data: [{ name: 'Private', private: true, password: 'secret' }],
    });
  });
});
