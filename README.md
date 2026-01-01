## Shorts Command Center

Replica of the AI InVideo workspace tailored to a YouTube Shorts growth workflow. The app loops Topic → Create → Schedule → Publish → Analyse → Recommend with a modern Next.js UI and a FastAPI automation service for schedulers.

### Requirements

- Node.js 18+
- Python 3.10+

### Environment Variables

Copy `.env.example` to `.env.local` and populate as needed:

- `YOUTUBE_API_KEY` – enable live channel metrics & uploads.
- `SEARCH_API_KEY`/`SEARCH_API_ENDPOINT` – power real-time trending topic search.
- `ASSET_SEARCH_KEY`/`ASSET_SEARCH_ENDPOINT` – fetch stock assets & templates.
- `TO_POST_FOLDER` & `POSTED_FOLDER` – absolute paths to your local media vaults.

### Run the Next.js workspace

```bash
npm install
npm run dev
```

Visit http://localhost:3000 to ideate topics, build Shorts, and manage scheduling.

### Run the automation service

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

The FastAPI server monitors scheduled uploads, moves files from `TO_POST_FOLDER` to `POSTED_FOLDER`, and backfills analytics when the laptop stays online.

### Deployment

Deploy the web workspace to Vercel once everything passes locally:

```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-807cf863
```

After deployment propagates, verify:

```bash
curl https://agentic-807cf863.vercel.app
```
