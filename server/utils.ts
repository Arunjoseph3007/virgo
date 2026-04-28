export const todo = (...args: any[]): never => {
  console.error("UNIMPLEMENTED", ...args);
  throw new Error("UNIMPLEMENTED");
};

export const unreachable = (...args: any[]): never => {
  console.error("REACHED UNREACHABLE", ...args);
  throw new Error("REACHED UNREACHABLE");
};

export const assert = (predicate: any, err?: string) => {
  console.assert(predicate, err);
  if (!predicate) {
    throw new Error(`ASSERTION FAILED, got falsy ${predicate}, err ${err}`);
  }
};
