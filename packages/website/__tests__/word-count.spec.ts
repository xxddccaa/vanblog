import { describe, expect, it } from "vitest";
import { countWords, formatWordCount } from "../utils/wordCount";

describe("countWords", () => {
  it("returns zeros for empty content", () => {
    expect(countWords("")).toEqual({ cjk: 0, words: 0, total: 0, minutes: 0 });
    expect(countWords("   \n  ")).toEqual({ cjk: 0, words: 0, total: 0, minutes: 0 });
  });

  it("counts CJK characters individually", () => {
    const result = countWords("你好世界");
    expect(result.cjk).toBe(4);
    expect(result.words).toBe(0);
    expect(result.total).toBe(4);
  });

  it("counts latin words as units", () => {
    const result = countWords("hello world foo");
    expect(result.cjk).toBe(0);
    expect(result.words).toBe(3);
    expect(result.total).toBe(3);
  });

  it("counts mixed CJK and latin content separately", () => {
    const result = countWords("我在学习 TypeScript 和 React");
    expect(result.cjk).toBe(5);
    expect(result.words).toBe(2);
    expect(result.total).toBe(7);
  });

  it("does not split a CJK-adjacent latin word", () => {
    const result = countWords("用Docker部署");
    expect(result.cjk).toBe(3);
    expect(result.words).toBe(1);
  });

  it("excludes link URLs but keeps link text", () => {
    const withLink = countWords("[点击这里](https://example.com/very/long/path)");
    expect(withLink.cjk).toBe(4);
    expect(withLink.words).toBe(0);
  });

  it("excludes image URLs and HTML tags", () => {
    const result = countWords('![图](https://cdn.example.com/a.png)<div class="wrapper">正文</div>');
    expect(result.cjk).toBe(3);
    expect(result.words).toBe(0);
  });

  it("excludes code fence markers but keeps code content", () => {
    const result = countWords("```javascript\nconst a = 1;\n```");
    expect(result.words).toBeGreaterThan(0);
    expect(result.cjk).toBe(0);
  });

  it("reports at least 1 minute for short non-empty content", () => {
    expect(countWords("短文").minutes).toBe(1);
  });

  it("estimates minutes with cn 350/min and en 160/min", () => {
    const result = countWords("中".repeat(700));
    expect(result.minutes).toBe(2);
    const english = countWords(Array(320).fill("word").join(" "));
    expect(english.minutes).toBe(2);
  });
});

describe("formatWordCount", () => {
  it("shows raw number under 1000", () => {
    expect(formatWordCount(0)).toBe("0");
    expect(formatWordCount(999)).toBe("999");
  });

  it("shows k-suffixed number from 1000", () => {
    expect(formatWordCount(1000)).toBe("1k");
    expect(formatWordCount(1234)).toBe("1.2k");
    expect(formatWordCount(12345)).toBe("12.3k");
  });
});
