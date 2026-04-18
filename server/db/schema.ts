import { relations, type InferSelectModel } from "drizzle-orm";
import {
  foreignKey,
  int,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  age: int().notNull(),
  email: text().notNull().unique(),
});

export const repos = sqliteTable("repos", {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  url: text().notNull(),
});

export const projects = sqliteTable("projects", {
  name: text({ length: 20 }).primaryKey(),
  folder: text().default(".").notNull(),
  repoId: int()
    .notNull()
    .references(() => repos.id, { onDelete: "restrict" }),
});

export const WS_STATES = [
  "OUT_OF_SYNC",
  "ERROR",
  "SYNC",
  "PROGRESSING",
] as const;

export const workspaces = sqliteTable(
  "workspaces",
  {
    name: text({ length: 20 }).notNull(),
    projectName: text({ length: 20 })
      .notNull()
      .references(() => projects.name, { onDelete: "restrict" }),
    gitTarget: text().notNull(),
    health: text({ enum: WS_STATES }).notNull().default("OUT_OF_SYNC"),
  },
  (table) => [
    unique().on(table.name, table.projectName),
    primaryKey({ columns: [table.name, table.projectName] }),
  ]
);

export const PARAM_TYPES = ["var", "var-file"] as const;

export const params = sqliteTable(
  "params",
  {
    id: int().primaryKey({ autoIncrement: true }),
    workspaceName: text().notNull(),
    projectName: text().notNull(),
    type: text({ enum: PARAM_TYPES }).notNull(),
    key: text().notNull(),
    value: text(),
  },
  (table) => [
    unique().on(table.workspaceName, table.key, table.type),
    foreignKey({
      columns: [table.projectName, table.workspaceName],
      foreignColumns: [workspaces.projectName, workspaces.name],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ]
);

export const projectRelations = relations(projects, ({ many, one }) => ({
  repo: one(repos, {
    fields: [projects.repoId],
    references: [repos.id],
  }),
  workspaces: many(workspaces),
}));

export const workspaceRelations = relations(workspaces, ({ one, many }) => ({
  project: one(projects, {
    fields: [workspaces.projectName],
    references: [projects.name],
  }),
  params: many(params),
}));

export const paramRelations = relations(params, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [params.workspaceName, params.projectName],
    references: [workspaces.name, workspaces.projectName],
  }),
}));

export type TUser = InferSelectModel<typeof users>;
export type TProject = InferSelectModel<typeof projects>;
export type TRepo = InferSelectModel<typeof repos>;
export type TWorkspace = InferSelectModel<typeof workspaces>;
export type TParam = InferSelectModel<typeof params>;
export type TParamType = typeof PARAM_TYPES[number]
export type TWSHealthStatus = typeof WS_STATES[number]