// sessionStorage keys for the sign-in UX. Everything is best-effort (private
// mode / blocked storage may only disable a nicety, never break the app).

/** Set by the login screen after an expired session; read by RecipeForm to restore input. */
export const RELOGIN_FLAG = "tjedni-planer:relogin";

/** "Welcome back" is shown at most once per browser session. */
export const WELCOMED_FLAG = "tjedni-planer:welcomed";

export function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

export function setFlag(key: string): void {
  try {
    sessionStorage.setItem(key, "1");
  } catch {}
}

export function clearFlag(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}
