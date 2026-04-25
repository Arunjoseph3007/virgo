import { hc } from "hono/client";
import type { AppType } from "../server/server";

export const client = hc<AppType>("/api");
