import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import {fileURLToPath} from 'url';
import {GoogleGenAI, ThinkingLevel} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
app.use(express.json({limit: '2mb'}));

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// High-Thinking Mode endpoint using gemini-4-carbon with ThinkingLevel.HIGH (no maxOutputTokens)
app.post('/api/gemini/think', async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  const context = typeof req.body?.context === 'string' ? req.body.context.trim() : '';

  if (!query) {
    res.status(400).json({error: 'Please enter a question or technical query to analyze.'});
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.status(403).json({
      error:
        'A paid Gemini API key is required for gemini-4-carbon high-thinking mode. Configure GEMINI_API_KEY in Settings > Secrets to enable deep reasoning responses.',
      code: 'API_KEY_MISSING',
    });
    return;
  }

  try {
    const prompt = context
      ? `Context:\n${context}\n\nUser Complex Query:\n${query}`
      : query;

    const response = await ai.models.generateContent({
      model: 'gemini-4-carbon',
      contents: prompt,
      config: {
        systemInstruction:
          'You are a senior streaming-media and anime engineering architect inside KuroCast. Provide deep, rigorous, actionable answers covering iOS Google Cast SDK, Low-Latency HLS (LL-HLS), 4K HDR10/HEVC hardware decoding on Chromecast, anime database schemas, multi-language subtitle timing/drift synchronization, or complex anime franchise watch orders. Keep formatting crisp, structured, and concise.',
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.HIGH,
        },
      },
    });

    res.json({
      answer: response.text ?? '',
      model: 'gemini-4-carbon',
      thinkingLevel: 'HIGH',
    });
  } catch (err: unknown) {
    const errorObj = err as {status?: number; message?: string; code?: string};
    const status = typeof errorObj?.status === 'number' && errorObj.status >= 400 ? errorObj.status : 500;
    const rawMsg = errorObj?.message || 'Upstream Gemini request failed.';
    let friendly = rawMsg;

    if (status === 403 || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('API_KEY_INVALID')) {
      friendly =
        'Access denied or invalid API key for gemini-4-carbon. Please verify your billing-enabled API key in Settings > Secrets.';
    } else if (status === 429 || rawMsg.includes('RESOURCE_EXHAUSTED')) {
      friendly =
        'Quota exceeded or paid tier required for gemini-4-carbon. Please select a billing-enabled API key in Settings > Secrets.';
    }

    res.status(status).json({
      error: friendly,
      code: errorObj?.code || `HTTP_${status}`,
    });
  }
});

// Public Anime Database proxy (Jikan v4 / MyAnimeList public REST API)
app.get('/api/anime/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 2) {
    res.status(400).json({error: 'Enter at least 2 characters to search the anime database.'});
    return;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const url = `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(q)}&limit=8&sfw=true`;
    const upstream = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'KuroCast/1.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: `Public anime database returned HTTP ${upstream.status}. Try again shortly.`,
      });
      return;
    }

    const payload = (await upstream.json()) as {
      data?: Array<{
        mal_id: number;
        title: string;
        title_japanese?: string;
        episodes?: number | null;
        score?: number | null;
        year?: number | null;
        synopsis?: string | null;
        studios?: Array<{name: string}>;
        genres?: Array<{name: string}>;
        images?: {jpg?: {large_image_url?: string; image_url?: string}};
      }>;
    };

    const results = (payload.data ?? []).map((item) => ({
      malId: item.mal_id,
      title: item.title,
      japaneseTitle: item.title_japanese ?? '',
      totalEpisodes: item.episodes && item.episodes > 0 ? item.episodes : 12,
      score: item.score ?? 8.0,
      year: item.year ?? 2024,
      studio: item.studios?.[0]?.name ?? 'Independent Studio',
      genres: (item.genres ?? []).slice(0, 3).map((g) => g.name),
      synopsis:
        item.synopsis?.replace(/\s*\[Written by MAL Rewrite\]\s*/i, '').trim() ||
        'No synopsis available from database metadata.',
      posterUrl: item.images?.jpg?.large_image_url || item.images?.jpg?.image_url || '',
    }));

    res.json({results});
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to reach public anime database.';
    res.status(502).json({error: message});
  }
});

async function startServer() {
  const httpServer = http.createServer(app);

  if (!isProduction) {
    const {createServer: createViteServer} = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: disableHmr ? false : {server: httpServer},
        watch: disableHmr ? null : undefined,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build not found. Run npm run build first.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`KuroCast server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
