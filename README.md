# KuroCast — 4K Cast & Anime Studio

Cross-platform dark-mode 4K Chromecast streaming deck, playlist queue manager, anime watchlist & episode tracker, multi-language subtitle synchronization studio, and installable offline PWA.

## Publish to GitHub Pages

1. Export or push this repository to GitHub (make sure your default branch is `main`).
2. Open your repository on GitHub and go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Push a commit to `main` (or trigger **Actions → Deploy KuroCast to GitHub Pages → Run workflow**).
5. Your live site will publish at `https://<your-username>.github.io/<your-repo-name>/`.

## Add KuroCast to Your iPhone

1. Open your GitHub Pages URL in **Safari** on iPhone.
2. Tap the **Share** button in the bottom toolbar.
3. Scroll down and tap **Add to Home Screen**, then tap **Add**.

## Local Development

```bash
npm install
npm run dev
```

To enable server-side Deep Reasoning (`gemini-4-carbon`), copy `.env.example` to `.env`, add your `GEMINI_API_KEY`, and run `npm run dev` or `npm run build && npm start`.
