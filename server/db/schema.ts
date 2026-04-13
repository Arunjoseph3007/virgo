import { int, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable("users", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  age: int().notNull(),
  email: text().notNull().unique(),
});

export const projectsTable = sqliteTable("projects", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  repoUrl: text().notNull(),
  folder: text().default(".").notNull(),
});

export const workspacesTable = sqliteTable(
  "workspaces",
  {
    id: int().primaryKey({ autoIncrement: true }),
    projectId: int()
      .notNull()
      .references(() => projectsTable.id),
    name: text().notNull(),
  },
  (table) => [unique().on(table.name, table.projectId)]
);

export const PARAM_TYPES = ["var", "var-file"] as const;

export const paramsTable = sqliteTable(
  "params",
  {
    id: int().primaryKey({ autoIncrement: true }),
    workspaceId: int()
      .notNull()
      .references(() => workspacesTable.id),
    type: text({ enum: PARAM_TYPES }).notNull(),
    key: text().notNull(),
    value: text(),
  },
  (table) => [unique().on(table.workspaceId, table.key, table.type)]
);
