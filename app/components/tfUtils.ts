import { ChangeType, type JsonValue } from "~/types/planData";

function formatValue(val: JsonValue): string {
  if (val === null) return "null";
  if (typeof val === "string") return `"${val}"`;
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return String(val);
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";
    return `[${val.map(formatValue).join(", ")}]`;
  }
  return JSON.stringify(val);
}

function isSkippableValue(val: JsonValue): boolean {
  if (val === null) return true;
  if (val === "") return true;
  if (Array.isArray(val) && val.length === 0) return true;
  return false;
}

export const ACTION_ICONS: Record<ChangeType, string> = {
  create: "+",
  delete: "-",
  update: "~",
  replace: "±",
  "no-op": "○",
};

export function getDiffSymbol(before: any, after: any): string {
  if (!before) return ACTION_ICONS[ChangeType.Create];
  if (!after) return ACTION_ICONS[ChangeType.Delete];
  if (JSON.stringify(before) == JSON.stringify(after))
    return ACTION_ICONS[ChangeType.Noop];
  return ACTION_ICONS[ChangeType.Update];
}

const isPlainObject = (val: any) =>
  val !== null && typeof val === "object" && !Array.isArray(val);

function stringifyExpr(val: JsonValue, level = 1): string {
  if (val === null) return "null";
  if (typeof val === "string") return `"${val}"`;
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return `${val}`;

  const indent = "  ".repeat(level);
  if (Array.isArray(val)) {
    if (val.length === 0) return "[]";

    let str = "[\n";

    val.forEach((ent) => {
      str += indent + stringifyExpr(ent, level + 1) + ",\n";
    });
    str += indent.slice(0, -2) + "]";
    return str;
  }

  // object
  if (Object.keys(val).length == 0) return "{}";
  let str = "{\n";

  for (const key in val) {
    if (
      Array.isArray(val[key]) &&
      val[key].length > 0 &&
      isPlainObject(val[key][0])
    ) {
      val[key].forEach((ent) => {
        str += indent + key + " " + stringifyExpr(ent, level + 1) + "\n";
      });
    } else if (isPlainObject(val[key])) {
      str += `${indent}${key} ${stringifyExpr(val[key], level + 1)}\n`;
    } else {
      str += `${indent}${key} = ${stringifyExpr(val[key], level + 1)}\n`;
    }
  }
  return str + indent.slice(0, -2) + "}";
}

function jsonToTf(name: string, type: string, data: JsonValue): string {
  return `resource "${type}" "${name}" ` + stringifyExpr(data);
}

function stringifyDiff(before: JsonValue, after: JsonValue, level = 0): string {
  const indent = "    ".repeat(level);
  const sindent = "    ".repeat(level - 1);

  // all primitives
  if (
    typeof before == "string" ||
    typeof after == "string" ||
    typeof before == "number" ||
    typeof after == "number" ||
    typeof before == "boolean" ||
    typeof after == "boolean"
  ) {
    // no diff
    if (JSON.stringify(before) == JSON.stringify(after))
      return stringifyExpr(before, level);

    return `${stringifyExpr(before, level)} -> ${stringifyExpr(after, level)}`;
  }

  // primitive array
  if (Array.isArray(before) || Array.isArray(after)) {
    before = (before || []) as any[];
    after = (after || []) as any[];

    const max = Math.max(before.length, after.length);
    if (max == 0) return "[]";
    let str = "[\n";
    for (let i = 0; i < max; i++) {
      str += indent;
      str += getDiffSymbol(before.at(i) ?? null, after.at(i) ?? null);
      str += " ";
      str += stringifyDiff(
        before.at(i) ?? null,
        after.at(i) ?? null,
        level + 1
      );
      str += ",\n";
    }
    return str + sindent + "]\n";
  }

  // objects
  if (isPlainObject(before) || isPlainObject(after)) {
    const keysSet = new Set<string>();
    for (const key in before) keysSet.add(key);
    for (const key in after) keysSet.add(key);

    if (keysSet.size == 0) return "{}";

    let str = "{\n";
    for (const key of keysSet) {
      const bVal = before && (before[key] ?? null);
      const aVal = after && (after[key] ?? null);

      if (
        Array.isArray(bVal) &&
        bVal.length > 0 &&
        isPlainObject(bVal[0]) &&
        Array.isArray(aVal) &&
        aVal.length > 0 &&
        isPlainObject(aVal[0])
      ) {
        const maxn = Math.max(bVal.length, aVal.length);

        for (let i = 0; i < maxn; i++) {
          str += indent;
          str += getDiffSymbol(bVal.at(i) ?? null, aVal.at(i) ?? null);
          str += " " + key + " ";
          str += stringifyDiff(
            bVal.at(i) ?? null,
            aVal.at(i) ?? null,
            level + 1
          );
          str += "\n";
        }
      } else if (isPlainObject(bVal) || isPlainObject(aVal)) {
        str += indent;
        str += getDiffSymbol(bVal, aVal);
        str += " " + key + " ";
        str += stringifyDiff(bVal, aVal, level + 1);
        str += "\n";
      } else {
        str += indent;
        str += getDiffSymbol(bVal, aVal);
        str += " " + key + " = ";
        str += stringifyDiff(bVal, aVal, level + 1);
        str += "\n";
      }
    }
    return str + sindent + "}";
  }

  return "SOMETHING WENT WRONG";
}
