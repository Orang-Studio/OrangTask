# Translation Updates

OrangTask uses the same Weblate update flow as OrangChat, hosted at
`https://oranges.lt/translate`. The English catalogues are the source of truth:

- Web: `src/lib/i18n/en.json`
- Android: `android/app/src/main/res/values/strings.xml`

The files are already in formats Weblate edits directly, so OrangTask does not
need OrangChat's TypeScript-to-JSON bridge. Weblate components should use:

- Web Client: `frontend/src/lib/i18n/*.json`, template `frontend/src/lib/i18n/en.json`, format `json`
- Android App: `android/app/src/main/res/values-*/strings.xml`, template `android/app/src/main/res/values/strings.xml`, format `aresource`

Pull published translations after a Weblate update with:

```sh
WEBLATE_LOCALES=lt npm run i18n:pull
```

The command downloads both the web JSON and Android XML from Weblate's
`/translate/download/orangtask/...` exports. Run `npm run i18n:check` before a
build to catch invalid JSON, stale web keys, or malformed Android resource
wrappers.
