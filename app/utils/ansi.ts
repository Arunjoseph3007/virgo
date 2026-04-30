const ANSI_STYLES: Record<number, string> = {
  // decorations
  1: "font-bold",
  2: "opacity-60",
  3: "italic",
  4: "underline",
  9: "line-through",
  // fg colors
  30: "text-gray-400",
  31: "text-red-400",
  32: "text-green-400",
  33: "text-yellow-400",
  34: "text-blue-400",
  35: "text-purple-400",
  36: "text-cyan-400",
  37: "text-gray-200",
  // bright variants
  90: "text-gray-500",
  91: "text-red-300",
  92: "text-green-300",
  93: "text-yellow-300",
  94: "text-blue-300",
  95: "text-purple-300",
  96: "text-cyan-300",
  97: "text-white",
};

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export class AnsiReplacer {
  private openSpans = 0;
  static RE = /\u001b\[([\d;]*)m/g;

  static convert(html: string) {
    const ansiRep = new AnsiReplacer();
    const escpaed = escapeHtml(html);
    const replacer = ansiRep.replace.bind(ansiRep);
    return escpaed.replace(AnsiReplacer.RE, replacer);
  }

  replace(_str: string, raw: string) {
    // RESET
    if (raw === "" || raw === "0") {
      const res = "</span>".repeat(this.openSpans);
      this.openSpans = 0;
      return res;
    }

    const clsStr = raw
      .split(";")
      .map(Number)
      .map((c) => ANSI_STYLES[c])
      .filter(Boolean)
      .join(" ");

    this.openSpans++;
    return `<span class="${clsStr}">`;
  }
}

/**
 * Full ANSI-to-HTML converter.
 * Handles compound codes (e.g. ESC[1;31m), all 8+8 fg colors, common styles,
 * and proper reset (closes all open spans on ESC[0m).
 *
 * Assumes that user is working with Tailwind CSS
 *
 * @str terminal output
 *
 * @returns html string
 */
export function ansiToHtml(str: string): string {
  const re = /\u001b\[([\d;]*)m/g;
  let result = "";
  let openSpans = 0;
  let lastIndex = 0;

  for (let match = re.exec(str); match != null; match = re.exec(str)) {
    result += escapeHtml(str.slice(lastIndex, match.index));
    lastIndex = re.lastIndex;

    // RESET
    const raw = match[1];
    if (raw === "" || raw === "0") {
      result += "</span>".repeat(openSpans);
      openSpans = 0;
      continue;
    }

    const clsStr = raw
      .split(";")
      .map(Number)
      .map((code) => ANSI_STYLES[code])
      .filter(Boolean)
      .join(" ");
    result += `<span class="${clsStr}">`;
    openSpans++;
  }
  result += escapeHtml(str.slice(lastIndex));
  result += "</span>".repeat(openSpans);
  return result;
}
