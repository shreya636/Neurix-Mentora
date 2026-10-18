const SUBJECTS = [
  { name: "IC", color: "#65539c" },
  { name: "Mathematics", color: "#7987b8" },
  { name: "Physics", color: "#9479bd" },
  { name: "Python", color: "#5b80a8" },
  { name: "Chemistry", color: "#b17a9a" }
];
const EXTRA_COLORS = ["#777092", "#a88dbf", "#587998"];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function subjectOrder(subject) {
  const index = SUBJECTS.findIndex((entry) => entry.name.toLocaleLowerCase() === subject.toLocaleLowerCase());
  return index < 0 ? SUBJECTS.length : index;
}

function wrapLabel(value, maxLength = 18, maxLines = 2) {
  const words = String(value || "Assessment").split(/\s+/).flatMap((word) => {
    if (word.length <= maxLength) return [word];
    const chunks = [];
    for (let index = 0; index < word.length; index += maxLength) chunks.push(word.slice(index, index + maxLength));
    return chunks;
  });
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = `${last.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`;
  }
  return lines;
}

export function renderPerformanceHistoryChart(marks, formatDate) {
  const validMarks = marks.filter((mark) =>
    mark.subject && Number.isFinite(mark.percent) && mark.percent >= 0 && mark.percent <= 100 &&
    mark.obtainedMarks != null && mark.obtainedMarks !== "" && mark.maxMarks != null && mark.maxMarks !== "" &&
    Number.isFinite(Number(mark.obtainedMarks)) && Number.isFinite(Number(mark.maxMarks)) && Number(mark.maxMarks) > 0);
  if (!validMarks.length) return "";

  const sortedMarks = [...validMarks].sort((a, b) =>
    a.assessmentDate.localeCompare(b.assessmentDate) ||
    a.assessmentLabel.localeCompare(b.assessmentLabel) ||
    subjectOrder(a.subject) - subjectOrder(b.subject) ||
    a.subject.localeCompare(b.subject) ||
    String(a.id || "").localeCompare(String(b.id || "")));
  const slots = [...new Map(sortedMarks.map((mark) => [
    `${mark.assessmentDate}\u0000${mark.assessmentLabel}`,
    { date: mark.assessmentDate, label: mark.assessmentLabel }
  ])).values()];
  const subjects = [...new Set(sortedMarks.map((mark) => mark.subject))]
    .sort((a, b) => subjectOrder(a) - subjectOrder(b) || a.localeCompare(b));
  const colorBySubject = new Map(subjects.map((subject, index) => {
    const canonical = SUBJECTS.find((entry) => entry.name.toLocaleLowerCase() === subject.toLocaleLowerCase());
    return [subject, canonical?.color || EXTRA_COLORS[(index - SUBJECTS.filter((entry) =>
      subjects.some((value) => value.toLocaleLowerCase() === entry.name.toLocaleLowerCase())).length) % EXTRA_COLORS.length]];
  }));

  const slotWidth = 156;
  const width = Math.max(720, slots.length * slotWidth + 112);
  const height = 360;
  const left = 58, right = 24, top = 22, chartBottom = 260;
  const plotHeight = chartBottom - top;
  const xAt = (index) => left + (index + 0.5) * (width - left - right) / slots.length;
  const yAt = (percent) => chartBottom - percent * plotHeight / 100;
  const grid = [0, 20, 40, 60, 80, 100].map((value) =>
    `<line class="history-grid" x1="${left}" y1="${yAt(value)}" x2="${width - right}" y2="${yAt(value)}"/><text class="history-axis" x="${left - 10}" y="${yAt(value) + 4}" text-anchor="end">${value}%</text>`
  ).join("");
  const bars = slots.map((slot, index) => {
    const groupMarks = sortedMarks.filter((mark) =>
      mark.assessmentDate === slot.date && mark.assessmentLabel === slot.label);
    const groupWidth = Math.min(112, (width - left - right) / slots.length * 0.78);
    const barGap = 4;
    const barWidth = Math.min(24, (groupWidth - barGap * (groupMarks.length - 1)) / groupMarks.length);
    const totalWidth = groupMarks.length * barWidth + (groupMarks.length - 1) * barGap;
    return groupMarks.map((mark, markIndex) => {
      const x = xAt(index) - totalWidth / 2 + markIndex * (barWidth + barGap);
      const y = yAt(mark.percent);
      const date = mark.assessmentDate ? formatDate(mark.assessmentDate) : "Date unavailable";
      const title = `${mark.subject} · ${mark.assessmentLabel} · ${date} · ${mark.obtainedMarks}/${mark.maxMarks} marks · ${mark.percent.toFixed(1)}%`;
      return `<rect class="history-bar" style="fill:${colorBySubject.get(mark.subject)}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${Math.max(1, barWidth).toFixed(2)}" height="${Math.max(0, chartBottom - y).toFixed(2)}" rx="2"><title>${escapeHtml(title)}</title></rect>`;
    }).join("");
  }).join("");
  const labels = slots.map((slot, index) => {
    const lines = wrapLabel(slot.label);
    const labelX = xAt(index);
    const labelY = chartBottom + 18;
    const labelLines = lines.map((line, lineIndex) =>
      `<tspan x="${labelX}" dy="${lineIndex ? 13 : 0}">${escapeHtml(line)}</tspan>`).join("");
    const date = slot.date ? formatDate(slot.date) : "Date unavailable";
    return `<text class="history-label" x="${labelX}" y="${labelY}" text-anchor="middle"><title>${escapeHtml(slot.label)} · ${escapeHtml(date)}</title>${labelLines}</text><text class="history-date" x="${labelX}" y="${labelY + lines.length * 13 + 3}" text-anchor="middle">${escapeHtml(date)}</text>`;
  }).join("");
  const legend = subjects.map((subject) =>
    `<span><i style="background:${colorBySubject.get(subject)}"></i>${escapeHtml(subject)}</span>`
  ).join("");

  return `<div class="history-chart-scroll"><svg class="history-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Grouped assessment results by subject. Hover over a bar for assessment details.">${grid}<line class="history-axis-line" x1="${left}" y1="${top}" x2="${left}" y2="${chartBottom}"/><line class="history-axis-line" x1="${left}" y1="${chartBottom}" x2="${width - right}" y2="${chartBottom}"/>${bars}${labels}</svg></div><div class="chart-legend">${legend}</div>`;
}
