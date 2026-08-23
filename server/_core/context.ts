import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  getUser?: () => Promise<User | null>;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let cachedUser: User | null | undefined = undefined;

  const getUser = async (): Promise<User | null> => {
    if (cachedUser !== undefined) return cachedUser;
    const hasCookie = Boolean(opts.req.headers.cookie);
    const hasAuthHeader = typeof opts.req.headers.authorization === "string" && opts.req.headers.authorization.startsWith("Bearer ");

    if (hasCookie || hasAuthHeader) {
      try {
        cachedUser = await sdk.authenticateRequest(opts.req);
        return cachedUser;
      } catch {
        cachedUser = null;
        return null;
      }
    }
    cachedUser = null;
    return null;
  };

  return {
    req: opts.req,
    res: opts.res,
    get user() {
      return cachedUser ?? null;
    },
    set user(val: User | null) {
      cachedUser = val;
    },
    getUser,
  };
}
