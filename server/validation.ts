import z from "zod";
import { PARAM_TYPES } from "./db/schema";

export const ApplyConfigSchema = z.object({
  target: z.array(z.string()).optional(),
});

export const RepoInsertSchema = z.object({
  name: z.string(),
  url: z.url(),
});

export const WorkspaceInsertSchema = z.object({
  name: z.string(),
  gitTarget: z.string(),
  params: z.array(
    z.object({
      key: z.string(),
      value: z.string().optional().nullable(),
      type: z.enum(PARAM_TYPES),
    })
  ),
});

export const WorkspaceUpdateSchema = z.object({
  gitTarget: z.string(),
  params: z.array(
    z.object({
      id: z.int(),
      key: z.string(),
      value: z.string().optional().nullable(),
      type: z.enum(PARAM_TYPES),
    })
  ),
});

export type TApplyConfig = z.infer<typeof ApplyConfigSchema>;
export type TRepoInsert = z.infer<typeof RepoInsertSchema>;
export type TWSInsert = z.infer<typeof WorkspaceInsertSchema>;
export type TWSUpdate = z.infer<typeof WorkspaceUpdateSchema>;
