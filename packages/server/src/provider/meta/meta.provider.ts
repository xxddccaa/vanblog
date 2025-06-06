import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Meta, MetaDocument } from 'src/scheme/meta.schema';
import { UpdateSiteInfoDto } from 'src/types/site.dto';
import { RewardItem } from 'src/types/reward.dto';
import { SocialItem, SocialType } from 'src/types/social.dto';
import { LinkItem } from 'src/types/link.dto';
import { UserProvider } from '../user/user.provider';
import { VisitProvider } from '../visit/visit.provider';
import { ArticleProvider } from '../article/article.provider';
import dayjs from 'dayjs';
import { isTrue } from 'src/utils/isTrue';
import { ViewerProvider } from '../viewer/viewer.provider';
@Injectable()
export class MetaProvider {
  logger = new Logger(MetaProvider.name);
  timer = null;
  constructor(
    @InjectModel('Meta')
    private metaModel: Model<MetaDocument>,
    private readonly userProvider: UserProvider,
    private readonly visitProvider: VisitProvider,
    private readonly viewProvider: ViewerProvider,
    @Inject(forwardRef(() => ArticleProvider))
    private readonly articleProvider: ArticleProvider,
  ) {}

  async updateTotalWords(reason: string) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      const total = await this.articleProvider.countTotalWords();
      await this.update({ totalWordCount: total });
      this.logger.log(`${reason}触发更新字数缓存：当前文章总字数: ${total}`);
    }, 1000 * 30);
  }

  async getViewer() {
    const old = await this.getAll();
    const ov = old.viewer || 0;
    const oldVisited = old.visited || 0;
    const newViewer = ov;
    const newVisited = oldVisited;
    return { visited: newVisited, viewer: newViewer };
  }
  async addViewer(isNew: boolean, pathname: string, isNewByPath: boolean) {
    const old = await this.getAll();
    const ov = old.viewer || 0;
    const oldVisited = old.visited || 0;
    const newViewer = ov + 1;
    let newVisited = oldVisited;
    let isNewVisitorByArticle = false;
    if (isTrue(isNew)) {
      newVisited += 1;
    }
    if (isTrue(isNewByPath)) {
      isNewVisitorByArticle = true;
    }
    // 这个是 meta 的
    await this.update({
      viewer: newViewer,
      visited: newVisited,
    });
    // 更新文章的
    const r = /\/post\//;
    const isArticlePath = r.test(pathname);
    if (isArticlePath) {
      await this.articleProvider.updateViewerByPathname(
        pathname.replace('/post/', ''),
        isNewByPath,
      );
    }
    // 还需要增加每天的
    this.viewProvider.createOrUpdate({
      date: dayjs().format('YYYY-MM-DD'),
      viewer: newViewer,
      visited: newVisited,
    });
    //增加每个路径的。
    this.visitProvider.add({
      pathname: pathname,
      isNew: isNewVisitorByArticle,
    });
    return { visited: newVisited, viewer: newViewer };
  }

  async getAll() {
    return this.metaModel.findOne().exec();
  }

  async getSocialTypes() {
    return [
      {
        label: '哔哩哔哩',
        value: 'bilibili',
        iconType: 'bilibili',
        linkType: 'link',
        displayName: '哔哩哔哩'
      },
      {
        label: '邮箱',
        value: 'email',
        iconType: 'email',
        linkType: 'email',
        displayName: 'Email'
      },
      {
        label: 'GitHub',
        value: 'github',
        iconType: 'github',
        linkType: 'link',
        displayName: 'GitHub'
      },
      {
        label: 'Gitee',
        value: 'gitee',
        iconType: 'gitee',
        linkType: 'link',
        displayName: 'Gitee'
      },
      {
        label: '微信',
        value: 'wechat',
        iconType: 'wechat',
        linkType: 'qrcode',
        displayName: '微信'
      },
      {
        label: '微信（暗色模式）',
        value: 'wechat-dark',
        iconType: 'wechat-dark',
        linkType: 'qrcode',
        displayName: '微信'
      },
      // 新增的联系方式类型
      {
        label: '微博',
        value: 'weibo',
        iconType: 'weibo',
        linkType: 'link',
        displayName: '微博'
      },
      {
        label: 'Twitter',
        value: 'twitter',
        iconType: 'twitter',
        linkType: 'link',
        displayName: 'Twitter'
      },
      {
        label: 'Facebook',
        value: 'facebook',
        iconType: 'facebook',
        linkType: 'link',
        displayName: 'Facebook'
      },
      {
        label: 'Instagram',
        value: 'instagram',
        iconType: 'instagram',
        linkType: 'link',
        displayName: 'Instagram'
      },
      {
        label: 'LinkedIn',
        value: 'linkedin',
        iconType: 'linkedin',
        linkType: 'link',
        displayName: 'LinkedIn'
      },
      {
        label: 'YouTube',
        value: 'youtube',
        iconType: 'youtube',
        linkType: 'link',
        displayName: 'YouTube'
      },
      {
        label: 'TikTok',
        value: 'tiktok',
        iconType: 'tiktok',
        linkType: 'link',
        displayName: 'TikTok'
      },
      {
        label: '知乎',
        value: 'zhihu',
        iconType: 'zhihu',
        linkType: 'link',
        displayName: '知乎'
      },
      {
        label: 'CSDN',
        value: 'csdn',
        iconType: 'csdn',
        linkType: 'link',
        displayName: 'CSDN'
      },
      {
        label: '掘金',
        value: 'juejin',
        iconType: 'juejin',
        linkType: 'link',
        displayName: '掘金'
      },
      {
        label: '微信公众号',
        value: 'wechat-mp',
        iconType: 'wechat-mp',
        linkType: 'qrcode',
        displayName: '微信公众号'
      },
      {
        label: 'QQ',
        value: 'qq',
        iconType: 'qq',
        linkType: 'link',
        displayName: 'QQ'
      },
      {
        label: 'Telegram',
        value: 'telegram',
        iconType: 'telegram',
        linkType: 'link',
        displayName: 'Telegram'
      },
      {
        label: 'Discord',
        value: 'discord',
        iconType: 'discord',
        linkType: 'link',
        displayName: 'Discord'
      },
      {
        label: '自定义',
        value: 'custom',
        iconType: 'custom',
        linkType: 'link',
        displayName: '自定义'
      }
    ];
  }
  async getTotalWords() {
    return (await this.getAll()).totalWordCount || 0;
  }

  async update(updateMetaDto: Partial<Meta>) {
    return this.metaModel.updateOne({}, updateMetaDto);
  }
  async getAbout() {
    return (await this.getAll())?.about;
  }
  async getSiteInfo() {
    return (await this.getAll())?.siteInfo;
  }
  async getRewards() {
    return (await this.getAll())?.rewards;
  }
  async getSocials() {
    return (await this.getAll())?.socials;
  }
  async getLinks() {
    return (await this.getAll())?.links;
  }

  async updateAbout(newContent: string) {
    return this.metaModel.updateOne(
      {},
      {
        about: {
          updatedAt: new Date(),
          content: newContent,
        },
      },
    );
  }

  async updateSiteInfo(updateSiteInfoDto: UpdateSiteInfoDto) {
    // @ts-ignore eslint-disable-next-line @typescript-eslint/ban-ts-comment
    const { name, password, ...updateDto } = updateSiteInfoDto;
    const oldSiteInfo = await this.getSiteInfo();
    return this.metaModel.updateOne({}, { siteInfo: { ...oldSiteInfo, ...updateDto } });
  }

  async addOrUpdateReward(addReward: Partial<RewardItem>) {
    const meta = await this.getAll();
    const toAdd: RewardItem = {
      updatedAt: new Date(),
      value: addReward.value,
      name: addReward.name,
    };
    const newRewards = [];
    let pushed = false;

    meta.rewards.forEach((r) => {
      if (r.name === toAdd.name) {
        pushed = true;
        newRewards.push(toAdd);
      } else {
        newRewards.push(r);
      }
    });
    if (!pushed) {
      newRewards.push(toAdd);
    }

    return this.metaModel.updateOne({}, { rewards: newRewards });
  }

  async deleteReward(name: string) {
    const meta = await this.getAll();
    const newRewards = [];
    meta.rewards.forEach((r) => {
      if (r.name !== name) {
        newRewards.push(r);
      }
    });
    return this.metaModel.updateOne({}, { rewards: newRewards });
  }

  async deleteSocial(type: SocialType) {
    const meta = await this.getAll();
    const newSocials = [];
    meta.socials.forEach((r, index) => {
      // 如果传入的type包含索引（如：qq-1, qq-2），就按完整type删除
      // 如果没有索引，就删除第一个匹配的类型
      if (type.includes('-') ? r.type !== type : (r.type !== type && !r.type.startsWith(type + '-'))) {
        newSocials.push(r);
      }
    });
    return this.metaModel.updateOne({}, { socials: newSocials });
  }

  async addOrUpdateSocial(addSocial: Partial<SocialItem>) {
    const meta = await this.getAll();
    const toAdd: SocialItem = {
      updatedAt: new Date(),
      value: addSocial.value,
      type: addSocial.type,
      // 支持新字段
      displayName: addSocial.displayName || addSocial.type,
      iconType: addSocial.iconType || addSocial.type as any,
      customIconUrl: addSocial.customIconUrl,
      customIconUrlDark: addSocial.customIconUrlDark,
      linkType: addSocial.linkType || 'link',
      darkValue: addSocial.darkValue,
      iconName: addSocial.iconName,
    };
    
    const newSocials = [...meta.socials];
    let pushed = false;
    
    // 查找是否有完全匹配的type（用于更新现有记录）
    for (let i = 0; i < newSocials.length; i++) {
      if (newSocials[i].type === toAdd.type) {
        newSocials[i] = toAdd;
        pushed = true;
        break;
      }
    }
    
    // 如果没有找到完全匹配的，直接添加新记录
    if (!pushed) {
      newSocials.push(toAdd);
    }

    return this.metaModel.updateOne({}, { socials: newSocials });
  }
  async addOrUpdateLink(addLinkDto: Partial<LinkItem>) {
    const meta = await this.getAll();
    const toAdd: LinkItem = {
      updatedAt: new Date(),
      url: addLinkDto.url,
      name: addLinkDto.name,
      desc: addLinkDto.desc,
      logo: addLinkDto.logo,
    };
    const newLinks = [];
    let pushed = false;

    meta.links.forEach((r) => {
      if (r.name === toAdd.name) {
        pushed = true;
        newLinks.push(toAdd);
      } else {
        newLinks.push(r);
      }
    });
    if (!pushed) {
      newLinks.push(toAdd);
    }

    return this.metaModel.updateOne({}, { links: newLinks });
  }

  async deleteLink(name: string) {
    const meta = await this.getAll();
    const newLinks = [];
    meta.links.forEach((r) => {
      if (r.name !== name) {
        newLinks.push(r);
      }
    });
    return this.metaModel.updateOne({}, { links: newLinks });
  }
}
