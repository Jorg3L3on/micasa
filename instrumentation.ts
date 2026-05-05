/** Load synchronously so no request runs before `Promise.try` exists. */
import "./src/lib/polyfills";

export async function register() {}
