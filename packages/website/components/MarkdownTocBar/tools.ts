export interface NavItem {
  index: number;
  level: number;
  listNo: string;
  text: string;
}

// Enhanced code block removal with better detection
export const washMarkdownContent = (source: string) => {
  if (!source) return "";
  
  let content = source;
  
  // Remove frontmatter first
  content = content.replace(/^---[\s\S]*?---\n?/g, "");
  
  // Enhanced code block removal with state tracking
  const lines = content.split('\n');
  const cleanedLines = [];
  let inFencedBlock = false;
  let fenceMarker = '';
  let indentLevel = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Check for fenced code block start/end
    const fenceMatch = trimmedLine.match(/^(```|~~~|`{4,})/);
    if (fenceMatch) {
      if (!inFencedBlock) {
        // Starting a fenced block
        inFencedBlock = true;
        fenceMarker = fenceMatch[1];
        continue; // Skip this line
      } else if (trimmedLine.startsWith(fenceMarker)) {
        // Ending a fenced block
        inFencedBlock = false;
        fenceMarker = '';
        continue; // Skip this line
      }
    }
    
    // Skip lines inside fenced blocks
    if (inFencedBlock) {
      continue;
    }
    
    // Check for indented code blocks (4+ spaces or tab at start)
    const indentMatch = line.match(/^(\s{4,}|\t+)/);
    if (indentMatch) {
      continue; // Skip indented code lines
    }
    
    // Keep the line
    cleanedLines.push(line);
  }
  
  content = cleanedLines.join('\n');
  
  // Remove other markdown elements
  content = content
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, "")
    // Remove custom containers (:::)
    .replace(/:::[\s\S]*?:::/g, "")
    // Remove inline code but keep the content
    .replace(/`([^`\n]+)`/g, "$1")
    // Remove bold/italic formatting but keep the content
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/_([^_\n]+)_/g, "$1")
    // Remove strikethrough but keep content
    .replace(/~~([^~\n]+)~~/g, "$1")
    // Remove links but keep the text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    // Remove HTML tags but keep content
    .replace(/<[^>]+>/g, "")
    // Clean up extra whitespace
    .replace(/\n\s*\n/g, "\n")
    .trim();
  
  return content + "\n";
};

// DOM-based approach for when available
export const parseNavStructureFromHTML = (): NavItem[] => {
  if (typeof document === 'undefined') {
    return [];
  }

  const headingSelectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  const allHeadings = document.querySelectorAll(
    '.markdown-body ' + headingSelectors.join(', .markdown-body ')
  );

  if (!allHeadings.length) {
    return [];
  }

  const navData: NavItem[] = [];
  
  allHeadings.forEach((heading, index) => {
    const tagName = heading.tagName.toLowerCase();
    const level = parseInt(tagName.replace('h', ''));
    
    let text = heading.textContent?.trim() || '';
    text = text.replace(/\s+/g, ' ').trim();
    
    if (text) {
      navData.push({
        index,
        level,
        text,
        listNo: ''
      });
    }
  });

  return generateListNumbers(navData);
};

// Main parsing function with improved fallback
export const parseNavStructure = (source: string): NavItem[] => {
  // First try DOM-based approach if available
  if (typeof document !== 'undefined') {
    const domResult = parseNavStructureFromHTML();
    if (domResult.length > 0) {
      return domResult;
    }
  }

  // Enhanced regex-based approach
  const contentWithoutCode = washMarkdownContent(source);
  const lines = contentWithoutCode.split('\n');
  const matchResult = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    // Strict heading pattern matching
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headingMatch) {
      const hashes = headingMatch[1];
      const title = headingMatch[2].trim();
      
      // Additional safety check: the title should not be a single character
      // or common code-like patterns
      if (title.length > 1 && !title.match(/^[^\w\u4e00-\u9fff]*$/)) {
        matchResult.push({
          fullMatch: line,
          hashes,
          title
        });
      }
    }
  }

  if (!matchResult.length) {
    return [];
  }

  const navData = matchResult.map((match, i) => {
    let titleText = cleanTitleText(match.title);
    
    return {
      index: i,
      level: match.hashes.length,
      text: titleText,
      listNo: '',
    };
  });

  return generateListNumbers(navData);
};

// Helper function to clean title text
const cleanTitleText = (titleText: string): string => {
  return titleText
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")  // links
    .replace(/`([^`]+)`/g, "$1")              // inline code
    .replace(/\*\*([^*]+)\*\*/g, "$1")       // bold
    .replace(/\*([^*]+)\*/g, "$1")           // italic
    .replace(/__([^_]+)__/g, "$1")           // bold
    .replace(/_([^_]+)_/g, "$1")             // italic
    .replace(/~~([^~]+)~~/g, "$1")           // strikethrough
    .replace(/<[^>]+>/g, "")                 // HTML tags
    .replace(/\s+/g, " ")                    // normalize whitespace
    .trim();
};

// Helper function to generate list numbers
const generateListNumbers = (navData: NavItem[]): NavItem[] => {
  if (!navData.length) return navData;

  let maxLevel = 0;
  navData.forEach((t) => {
    if (t.level > maxLevel) {
      maxLevel = t.level;
    }
  });
  
  let matchStack = [];
  
  for (let i = 0; i < navData.length; i++) {
    const t: any = navData[i];
    const { level } = t;
    
    while (
      matchStack.length &&
      matchStack[matchStack.length - 1].level >= level
    ) {
      matchStack.pop();
    }
    
    if (matchStack.length === 0) {
      const arr = new Array(maxLevel).fill(0);
      arr[level - 1] = 1;
      matchStack.push({
        level,
        arr,
      });
      t.listNo = trimArrZero(arr).join(".");
    } else {
      const parentArr = matchStack[matchStack.length - 1].arr;
      const newArr = [...parentArr];
      newArr[level - 1] = (newArr[level - 1] || 0) + 1;
      
      for (let j = level; j < maxLevel; j++) {
        newArr[j] = 0;
      }
      
      matchStack.push({
        level,
        arr: newArr,
      });
      t.listNo = trimArrZero(newArr).join(".");
    }
  }
  
  return navData;
};

const trimArrZero = (arr: any) => {
  let start, end;
  for (start = 0; start < arr.length; start++) {
    if (arr[start]) {
      break;
    }
  }
  for (end = arr.length - 1; end >= 0; end--) {
    if (arr[end]) {
      break;
    }
  }
  return arr.slice(start, end + 1);
};

export const getEl = (item: NavItem, all: NavItem[]) => {
  const tagName = `h${item.level}`;
  
  let els = document.querySelectorAll(`${tagName}[data-id="${item.text}"]`);
  
  if (els.length === 0) {
    els = document.querySelectorAll(`${tagName}[id="${item.text}"]`);
  }
  
  if (els.length === 0) {
    const allHeadings = document.querySelectorAll(tagName);
    for (let i = 0; i < allHeadings.length; i++) {
      const heading = allHeadings[i];
      const headingText = heading.textContent?.trim() || "";
      
      if (headingText === item.text) {
        return heading;
      }
      
      const normalizedHeadingText = headingText.replace(/\s+/g, " ").trim();
      const normalizedItemText = item.text.replace(/\s+/g, " ").trim();
      
      if (normalizedHeadingText === normalizedItemText) {
        return heading;
      }
    }
    
    console.warn(`Could not find element for heading: ${tagName} with text "${item.text}"`);
    return null;
  }
  
  if (els.length > 1) {
    const sameTextItems = all.filter((j) => 
      j.level === item.level && j.text === item.text
    );
    const itemIndex = sameTextItems.findIndex((val) => val.index === item.index);
    return els[Math.min(itemIndex, els.length - 1)];
  }
  
  return els[0];
};
