import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from 'src/storage/mongoose-compat';
import { Model } from 'src/storage/mongoose-compat';
import { UpdateUserDto } from 'src/types/user.dto';
import { User, UserDocument } from 'src/scheme/user.schema';
import { Collaborator } from 'src/types/collaborator';
import { encryptPassword, makeSalt, washPassword } from 'src/utils/crypto';
import { StructuredDataService } from 'src/storage/structured-data.service';

@Injectable()
export class UserProvider {
  logger = new Logger(UserProvider.name);
  constructor(
    @InjectModel('User') private userModel: Model<UserDocument>,
    private readonly structuredDataService: StructuredDataService,
  ) {}
  async getUser(isList?: boolean) {
    const user = await this.structuredDataService.getUserById(0);
    if (user) {
      if (isList) {
        return {
          id: user.id,
          name: user.name,
          nickname: user.nickname,
        };
      }
      return user;
    }
    if (isList) {
      return await this.userModel.findOne({ id: 0 }, { id: 1, name: 1, nickname: 1 });
    }
    return await this.userModel.findOne({ id: 0 }).exec();
  }
  async getAllUsers() {
    const users = await this.structuredDataService.listUsers();
    if (users.length) {
      return users;
    }
    return await this.userModel.find({}).lean().exec();
  }
  async importUsers(users: User[]) {
    for (const user of users || []) {
      if (user?.id === undefined || !user?.name) {
        continue;
      }

      const payload: any = { ...user };
      delete payload._id;
      delete payload.__v;

      await this.userModel.updateOne({ id: user.id }, payload, { upsert: true });
      await this.structuredDataService.upsertUser(payload);
    }
  }
  async washUserWithSalt() {
    // 如果没加盐的老版本，给改成带加盐的。
    const users = await this.userModel.find({
      $or: [
        {
          salt: '',
        },
        {
          salt: { $exists: false },
        },
      ],
    });
    if (users && users.length > 0) {
      this.logger.log(`老版本清洗密码未加盐用户 ${users.length} 人`);
      for (const user of users) {
        const salt = makeSalt();
        const newPassword = washPassword(user.name, user.password, salt);
        await this.userModel.updateOne({ id: user.id }, { password: newPassword, salt });
        await this.structuredDataService.upsertUser({
          ...user.toObject(),
          password: newPassword,
          salt,
        });
      }
    }
  }

  async validateUser(name: string, password: string) {
    const user =
      (await this.structuredDataService.getUserByName(name)) ||
      (await this.userModel.findOne({ name }).lean().exec());
    if (!user) {
      return null;
    } else {
      const encryptedPassword = encryptPassword(name, password, user.salt);
      const result =
        user.password === encryptedPassword
          ? user
          : await this.userModel.findOne({ name, password: encryptedPassword }).exec();
      if (result) {
        this.updateSalt(result, password);
      }
      return result;
    }
  }

  async updateSalt(user: User, passwordInput: string) {
    const newSalt = makeSalt();
    const password = encryptPassword(user.name, passwordInput, newSalt);
    await this.userModel.updateOne(
      { id: user.id },
      {
        salt: newSalt,
        password,
      },
    );
    await this.structuredDataService.upsertUser({
      ...(user as any)?.toObject?.(),
      ...user,
      salt: newSalt,
      password,
    });
  }

  async updateUser(updateUserDto: UpdateUserDto) {
    const currUser = await this.getUser();

    if (!currUser) {
      throw new NotFoundException();
    } else {
      const password = encryptPassword(updateUserDto.name, updateUserDto.password, currUser.salt);
      const result = await this.userModel
        .updateOne(
          { id: currUser.id },
          {
            ...updateUserDto,
            password,
          },
        );
      await this.structuredDataService.upsertUser({
        ...(currUser as any)?.toObject?.(),
        ...currUser,
        ...updateUserDto,
        password,
      });
      return result;
    }
  }
  async getNewId() {
    return await this.structuredDataService.nextUserId();
  }
  async getCollaboratorByName(name: string) {
    const collaborator = await this.structuredDataService.getUserByName(name);
    if (collaborator?.type === 'collaborator') {
      return collaborator;
    }
    return await this.userModel.findOne({ name: name, type: 'collaborator' });
  }
  async getCollaboratorById(id: number) {
    const collaborator = await this.structuredDataService.getUserById(id);
    if (collaborator?.type === 'collaborator') {
      return collaborator;
    }
    return await this.userModel.findOne({ id, type: 'collaborator' });
  }
  async getAllCollaborators(isList?: boolean) {
    const collaborators = await this.structuredDataService.getUsersByType('collaborator');
    if (collaborators.length) {
      if (isList) {
        return collaborators.map((item) => ({
          id: item.id,
          name: item.name,
          nickname: item.nickname,
        }));
      }
      return collaborators.map((item) => ({
        ...item,
        password: undefined,
        salt: undefined,
      }));
    }
    if (isList) {
      return await this.userModel.find(
        { type: 'collaborator' },
        { id: 1, name: 1, nickname: 1, _id: 0 },
      );
    }
    return await this.userModel.find({ type: 'collaborator' }, { salt: 0, password: 0, _id: 0 });
  }

  async createCollaborator(collaboratorDto: Collaborator) {
    const { name } = collaboratorDto;
    const oldData = await this.getCollaboratorByName(name);
    if (oldData) {
      throw new ForbiddenException('已有为该用户名的协作者，不可重复创建！');
    }
    const salt = makeSalt();
    const created = await this.userModel.create({
      id: await this.getNewId(),
      type: 'collaborator',
      ...collaboratorDto,
      password: encryptPassword(collaboratorDto.name, collaboratorDto.password, salt),
      salt,
    });
    await this.structuredDataService.upsertUser(created.toObject());
    return created;
  }
  async updateCollaborator(collaboratorDto: Collaborator) {
    const { name } = collaboratorDto;
    const oldData = await this.getCollaboratorByName(name);
    if (!oldData) {
      throw new ForbiddenException('没有此协作者！无法更新！');
    }
    const salt = makeSalt();
    const password = encryptPassword(collaboratorDto.name, collaboratorDto.password, salt);
    const result = await this.userModel.updateOne(
      {
        id: oldData.id,
        type: 'collaborator',
      },
      {
        ...collaboratorDto,
        password,
        salt,
      },
    );
    await this.structuredDataService.upsertUser({
      ...(oldData as any)?.toObject?.(),
      ...oldData,
      ...collaboratorDto,
      password,
      salt,
      id: oldData.id,
      type: 'collaborator',
    });
    return result;
  }
  async deleteCollaborator(id: number) {
    await this.userModel.deleteOne({ id: id, type: 'collaborator' });
    await this.structuredDataService.deleteUserById(id);
  }
}
