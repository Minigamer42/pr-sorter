# Agent Notes

## Local Dev Server And HMR

When a dev server is already running, prefer using the live server and HMR for UI checks.
- CSS, app source, and `customize/` files such as `customize/config.ts` and `customize/songList.ts` update through HMR while the dev server is running.
- For visual/layout work, edit the file, let HMR refresh the page, and verify in the browser.
- Run `npm run build` only as a final validation step, or when the user explicitly asks for a build.
