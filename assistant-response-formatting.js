function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderInlineMarkdown(value) {
  const codeSpans = [];
  const mathSpans = [];
  let html = escapeHtml(value).replace(/`([^`\n]+)`/g, (_, code) => {
    const token = `\uE000${codeSpans.length}\uE001`;
    codeSpans.push(`<code>${code}</code>`);
    return token;
  });

  html = html.replace(/(\${1,2})(.+?)\1/g, (_, delimiter, formula) => {
    const token = `\uE100${mathSpans.length}\uE101`;
    mathSpans.push(`${delimiter}${formula}${delimiter}`);
    return token;
  });

  html = html
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*|__(.+?)__/g, (_, a, b) => `<strong>${a || b}</strong>`)
    .replace(/\*([^*\n]+)\*|_([^_\n]+)_/g, (_, a, b) => `<em>${a || b}</em>`)
    .replace(/~~(.+?)~~/g, "<del>$1</del>");

  html = html.replace(/\uE100(\d+)\uE101/g, (_, index) => mathSpans[Number(index)]);
  return html.replace(/\uE000(\d+)\uE001/g, (_, index) => codeSpans[Number(index)]);
}

function parseTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line) {
  const cells = parseTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function renderTable(lines, startIndex) {
  const headings = parseTableRow(lines[startIndex]);
  const rows = [];
  let index = startIndex + 2;
  while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
    rows.push(parseTableRow(lines[index]));
    index += 1;
  }

  const renderCells = (cells, tag) => `<tr>${headings.map((_, cellIndex) => {
    const content = renderInlineMarkdown(cells[cellIndex] || "");
    return `<${tag}>${content}</${tag}>`;
  }).join("")}</tr>`;
  const body = rows.map((row) => renderCells(row, "td")).join("");
  return {
    html: `<div class="assistant-markdown-table-wrap"><table><thead>${renderCells(headings, "th")}</thead><tbody>${body}</tbody></table></div>`,
    nextIndex: index
  };
}

export function formatAssistantResponse(value) {
  const lines = String(value || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let listTag = "";
  let codeLines = [];
  let inCodeBlock = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const closeList = () => {
    if (!listTag) return;
    blocks.push(`</${listTag}>`);
    listTag = "";
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (/^\s*```/.test(line)) {
      flushParagraph();
      closeList();
      if (inCodeBlock) {
        blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
        codeLines = [];
      }
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*(\d+)[.)]\s+(.+)$/);
    const quote = line.match(/^\s*>\s?(.*)$/);

    if (line.includes("|") && lines[lineIndex + 1]?.includes("|") && isTableSeparator(lines[lineIndex + 1])) {
      flushParagraph();
      closeList();
      const table = renderTable(lines, lineIndex);
      blocks.push(table.html);
      lineIndex = table.nextIndex - 1;
    } else if (!line.trim() || /^\s*(?:(?:-{3,})|(?:\*{3,})|(?:_{3,}))\s*$/.test(line)) {
      flushParagraph();
      closeList();
    } else if (heading) {
      flushParagraph();
      closeList();
      blocks.push(`<h3>${renderInlineMarkdown(heading[1])}</h3>`);
    } else if (unordered || ordered) {
      flushParagraph();
      const nextListTag = unordered ? "ul" : "ol";
      if (listTag !== nextListTag) {
        closeList();
        blocks.push(`<${nextListTag}>`);
        listTag = nextListTag;
      }
      if (ordered && listTag === "ol" && Number(ordered[1]) !== 1) {
        const openListIndex = blocks.length - 1;
        if (blocks[openListIndex] === "<ol>") blocks[openListIndex] = `<ol start="${Number(ordered[1])}">`;
      }
      blocks.push(`<li>${renderInlineMarkdown(unordered ? unordered[1] : ordered[2])}</li>`);
    } else if (quote) {
      flushParagraph();
      closeList();
      blocks.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
    } else {
      closeList();
      paragraph.push(line.trim());
    }
  }

  flushParagraph();
  closeList();
  if (inCodeBlock) blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
  return blocks.join("");
}
