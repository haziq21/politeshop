import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import pino from "pino";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any }
  ? Omit<T, "children">
  : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};

export function arrEq<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Modified djb2 hash that returns a 32-bit signed integer.
 */
export function hash32Signed(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

export const logger = pino({
  level: import.meta.env.DEV ? "debug" : "warn",
  base: undefined,
  transport: import.meta.env.DEV
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid",
        },
      }
    : undefined,
});
