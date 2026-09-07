import { visit } from 'unist-util-visit';
import { BytemdPlugin } from 'bytemd';
import m from 'medium-zoom';

export const enhanceImages = (markdownBody: HTMLElement) => {
  const cleanups: Array<() => void> = [];
  markdownBody.querySelectorAll<HTMLImageElement>('.img-zoom').forEach((img) => {
    if (img.hasAttribute('data-zoomed')) return;
    const zoom = m(img);
    img.setAttribute('data-zoomed', 'true');
    cleanups.push(() => {
      zoom.detach();
      img.removeAttribute('data-zoomed');
    });
  });
  return () => cleanups.forEach((cleanup) => cleanup());
};
const ImgZoomPlugin = () => (tree) => {
  visit(tree, (node) => {
    if (node.type === 'element' && node.tagName === 'img') {
      node.properties.className += ' img-zoom';
    }
  });
};

export function Img(): BytemdPlugin {
  return {
    rehype: (processor) => processor.use(ImgZoomPlugin),
    viewerEffect: ({ markdownBody }) => {
      return enhanceImages(markdownBody);
    },
  };
}
