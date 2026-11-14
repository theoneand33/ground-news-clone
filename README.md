<img src="assets/icon.svg" width="64" height="64" alt="">

# ground-news-clone

News aggregator that groups headlines from 110 outlets into stories and shows how left, center and right outlets cover each one.

```
npm install
npm start        # builds the React UI (Vite) and serves it plus /api/stories on $PORT (default 3000)
npm run dev      # UI with hot reload; proxies /api to `npm start` ($API, default http://localhost:3000)
npm test
```

Outlets and their bias labels live in `sources.json`.
