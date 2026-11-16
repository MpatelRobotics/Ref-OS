import { PDFDocument, StandardFonts, breakTextIntoLines } from "pdf-lib";

const numericOrder = (a, b) => a.localeCompare(b, "en", { numeric: true });

export async function buildMatchAnomalyLog({ template, eventName, rows, ruleDescriptions = new Map() }) {
  const blank = await PDFDocument.load(template);
  const pdf = await PDFDocument.create();
  const [original] = await pdf.copyPages(blank, [0]);
  pdf.addPage(original);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const characters = new Set(regular.getCharacterSet());
  const clean = value => Array.from(String(value ?? "").replace(/\s+/g, " ").trim())
    .map(character => characters.has(character.codePointAt(0)) ? character : "?").join("");
  const wrap = (text, width, size, font = regular) =>
    breakTextIntoLines(clean(text), [" "], width, line => font.widthOfTextAtSize(line, size));
  const fit = (page, value, x, y, width, size, font = regular) => {
    const text = clean(value);
    if (!text) return;
    const fittedSize = Math.min(size, size * width / font.widthOfTextAtSize(text, size));
    page.drawText(text, { x, y, size: fittedSize, font });
  };

  const teams = new Map();
  const rules = new Map();
  for (const row of rows) {
    if (!teams.has(row.team)) teams.set(row.team, []);
    teams.get(row.team).push(row);
    for (const code of new Set(row.rules)) {
      if (!rules.has(code)) rules.set(code, new Map());
      const byTeam = rules.get(code);
      if (!byTeam.has(row.team)) byTeam.set(row.team, []);
      byTeam.get(row.team).push(row.match);
    }
  }

  let page = original;
  let slot = 0;
  const logPages = [original];
  for (const [team, entries] of [...teams].sort(([a], [b]) => numericOrder(a, b))) {
    const lines = entries.flatMap(row => {
      const details = [row.match, row.rules.map(code => `<${code}>`).join(" "), row.notes, row.result, `Logged by ${row.by}`];
      return wrap(details.filter(Boolean).join(" | "), 428, 8).map((text, index) => ({
        text,
        major: index === 0 && row.type === "major" ? row.rules.join(", ") || "Major" : "",
        minor: index === 0 && row.type === "minor" ? row.rules.join(", ") || "Minor" : "",
      }));
    });
    for (let offset = 0; offset < lines.length; offset += 4) {
      if (slot === 9) {
        [page] = await pdf.copyPages(blank, [0]);
        pdf.addPage(page);
        logPages.push(page);
        slot = 0;
      }
      const top = 535.2 - slot * 48.22;
      fit(page, team, 40, top - 14, 59, 9, bold);
      lines.slice(offset, offset + 4).forEach(({ text, major, minor }, index) => {
        const y = top - index * 12.05;
        fit(page, major, 110, y, 99, 8);
        fit(page, minor, 219, y, 99, 8);
        fit(page, text, 327.5, y, 428, 8);
      });
      slot++;
    }
  }

  let summaryPage;
  let y;
  const newSummaryPage = () => {
    summaryPage = pdf.addPage([792, 612]);
    fit(summaryPage, "Violations by rule", 33, 572, 720, 16, bold);
    fit(summaryPage, eventName, 33, 552, 720, 11);
    y = 526;
  };
  const summaryLine = (text, font = regular, size = 10, indent = 0) => {
    for (const line of wrap(text, 724 - indent, size, font)) {
      if (y < 42) newSummaryPage();
      fit(summaryPage, line, 33 + indent, y, 724 - indent, size, font);
      y -= size + 5;
    }
  };
  newSummaryPage();
  if (!rules.size) summaryLine("No rule codes were recorded.");
  for (const [code, byTeam] of [...rules].sort(([a], [b]) => numericOrder(a, b))) {
    const description = ruleDescriptions.get(code);
    const descriptionHeight = description ? wrap(description, 724, 10).length * 15 : 0;
    if (y < Math.min(526, 68 + descriptionHeight)) newSummaryPage();
    summaryLine(`<${code}>`, bold, 12);
    if (description) summaryLine(description);
    for (const [team, matches] of [...byTeam].sort(([a], [b]) => numericOrder(a, b))) {
      const counts = new Map();
      for (const match of matches) counts.set(match, (counts.get(match) || 0) + 1);
      const matchList = [...counts].map(([match, count]) => count > 1 ? `${match} (x${count})` : match);
      summaryLine(`${team} | ${matches.length} ${matches.length === 1 ? "violation" : "violations"} | ${matchList.join(", ")}`, regular, 10, 12);
    }
    y -= 8;
  }

  logPages.forEach(logPage => fit(logPage, eventName, 33, 568, 720, 11, bold));
  pdf.getPages().forEach((outputPage, index) => fit(outputPage, `Page ${index + 1} of ${pdf.getPageCount()}`, 33, 22, 720, 8));
  pdf.setTitle(`Referee Match Anomaly Log - ${eventName}`);
  return pdf.save();
}
