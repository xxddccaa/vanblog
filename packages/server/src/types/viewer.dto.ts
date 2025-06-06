export class createViewerDto {
  visited: number;
  viewer: number;
  date: string;
}

export class UpdateSiteViewerDto {
  viewer: number;
  visited: number;
}

export class UpdateArticleViewerDto {
  id: number;
  viewer: number;
  visited: number;
}

export class BatchUpdateViewerDto {
  articles: UpdateArticleViewerDto[];
  siteViewer: number;
  siteVisited: number;
}
