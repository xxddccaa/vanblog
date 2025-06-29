import { BytemdPlugin } from "bytemd";
import { visit } from "unist-util-visit";


const headings = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6'
]

const onClickHeading = (e: any) => {
  const id = e.target.getAttribute('data-id');
  // 改一下 hash
  window.location.hash = `#${id}`;
}

const headingPlugin = () => (tree) => {
  visit(tree, (node) => {
    if (node.type === "element" && headings.includes(node.tagName)) {
      // 获取标题的完整文本内容，包括处理嵌套元素
      const getTitleText = (node) => {
        if (node.type === "text") {
          return node.value;
        }
        if (node.children && node.children.length > 0) {
          return node.children.map(getTitleText).join('');
        }
        return '';
      };
      
      let title = getTitleText(node);
      
      if (title) {
        // Clean the title text to match TOC parsing logic
        title = title
          .replace(/`([^`]+)`/g, "$1")           // inline code
          .replace(/\*\*([^*]+)\*\*/g, "$1")    // bold
          .replace(/\*([^*]+)\*/g, "$1")        // italic
          .replace(/__([^_]+)__/g, "$1")        // bold
          .replace(/_([^_]+)_/g, "$1")          // italic
          .replace(/~~([^~]+)~~/g, "$1")        // strikethrough
          .replace(/<[^>]+>/g, "")              // HTML tags
          .replace(/\s+/g, " ")                 // normalize whitespace
          .trim();
        
        node.properties['data-id'] = title;
        node.properties['id'] = title;
        node.properties['class'] = 'markdown-heading cursor-pointer';
      }
    }
  });
}

export function Heading(): BytemdPlugin {
  return {
    rehype: (processor) => processor.use(headingPlugin),
    viewerEffect: ({markdownBody}) => {
      const headings = markdownBody.querySelectorAll('.markdown-heading');
      headings.forEach((heading) => {
        heading.removeEventListener('click', onClickHeading);
        heading.addEventListener('click', onClickHeading);
      });
    }
  };
}
