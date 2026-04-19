export const todo = (...args: any[]): never => {
  console.error("UNIMPLEMENTED", ...args);
  throw new Error("UNIMPLEMENTED");
};

export const unreachable = (...args: any[]): never => {
  console.error("REACHED UNREACHABLE", ...args);
  throw new Error("REACHED UNREACHABLE");
};
