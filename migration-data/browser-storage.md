# Browser storage when changing ports

The application code does not use `localStorage`, `sessionStorage`, IndexedDB or cookies. Storybook itself stores panel/navigation preferences in browser `localStorage` (for example `lastViewedStoryIds` and `@storybook/manager/store`). Browser storage belongs to an origin, including its port and hostname; the React and Vue pilots therefore have separate storage. The Playwright checks used a fresh browser context and could not read your normal browser profile.

To keep your own Storybook preferences or any other data stored in your browser:

1. Open the **React** Storybook at `http://localhost:6006/` in your usual browser. Open DevTools → Console and run the export snippet below. Save the downloaded JSON privately.
2. Open the **Vue** Storybook at `http://localhost:6007/` using the same hostname in that browser. Open DevTools → Console and run the import snippet. Select the JSON file, then reload the page.
3. Repeat for the demo origins `http://localhost:5173/` and `http://localhost:5174/` if you have stored custom data there. This pilot's demo does not store any.

Export in the old origin:

```js
const data = {
  localStorage: Object.fromEntries(Object.entries(localStorage)),
  sessionStorage: Object.fromEntries(Object.entries(sessionStorage)),
};
const a = document.createElement('a');
a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
a.download = 'cta-pilot-browser-storage.json';
a.click();
setTimeout(() => URL.revokeObjectURL(a.href), 1000);
```

Import in the new origin:

```js
const input = document.createElement('input');
input.type = 'file';
input.accept = 'application/json';
input.onchange = async () => {
  const file = input.files?.[0];
  if (!file) return;
  const data = JSON.parse(await file.text());
  for (const [key, value] of Object.entries(data.localStorage ?? {})) localStorage.setItem(key, String(value));
  for (const [key, value] of Object.entries(data.sessionStorage ?? {})) sessionStorage.setItem(key, String(value));
  location.reload();
};
input.click();
```

The archived React review state in this folder is for recovery and inspection. Reprepare the Vue proposal after a fresh Figma check; do not copy the old state into `src/design-review/.local/state.json` because its source hash refers to React files. The original React `.local` directory also remains in the dated backup.
