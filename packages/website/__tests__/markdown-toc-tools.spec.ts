// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { getEl, type NavItem } from "../components/MarkdownTocBar/tools";

describe("markdown toc tools", () => {
  it("finds headings whose data-id contains quotes without throwing", () => {
    document.body.innerHTML = `
      <div class="markdown-body">
        <h4
          class="markdown-heading"
          data-id='-v "$HOST_MODEL_PATH":"$CONTAINER_MODEL_PATH":ro'
          id='-v "$HOST_MODEL_PATH":"$CONTAINER_MODEL_PATH":ro'
        >
          -v "$HOST_MODEL_PATH":"$CONTAINER_MODEL_PATH":ro
        </h4>
      </div>
    `;

    const item: NavItem = {
      index: 0,
      level: 4,
      listNo: "1",
      text: '-v "$HOST_MODEL_PATH":"$CONTAINER_MODEL_PATH":ro',
    };

    const el = getEl(item, [item]);

    expect(el).toBeInstanceOf(HTMLElement);
    expect(el?.textContent).toContain("$HOST_MODEL_PATH");
  });
});
