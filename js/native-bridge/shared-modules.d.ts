/**
 * Wildcard declaration for vendored shared JS modules.
 *
 * `js/shared/` files are vendored verbatim from Hevolve_React_Native.
 * They are written in plain JS (no TypeScript types) and we don't
 * type-check them — Babel/Metro handle them at runtime.
 *
 * App.tsx imports them with relative paths, but tsc would otherwise
 * error TS7016 (no declaration file). Declaring them as `any` here
 * suppresses the error while keeping strict checking for our own
 * iOS-specific TS code.
 */

declare module './js/shared/*';
declare module './js/shared/**';
declare module '*/js/shared/*';
declare module '*/js/shared/**';
