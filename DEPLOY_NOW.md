# Quick Vercel Deployment

## One-Command Deploy

```bash
vercel --prod
```

That's it! Your app will be live in ~2 minutes.

## Setup (First Time Only)

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Login:
```bash
vercel login
```

3. Deploy:
```bash
vercel
```

4. Add your OpenAI API key:
- Go to vercel.com dashboard
- Select your project
- Settings > Environment Variables
- Add: `OPENAI_API_KEY` = `your-key-here`
- Redeploy: `vercel --prod`

## Your Live URL

After deployment, you'll get a URL like:
`https://lordsfx.vercel.app`

## Auto-Deploy from GitHub

1. Push code to GitHub
2. Connect repo at vercel.com
3. Every push = automatic deployment

## Custom Domain

1. Go to vercel.com > your project > Settings > Domains
2. Add your domain (e.g., lordsfx.com)
3. Update DNS records as shown
4. Done!

---

**Troubleshooting:**
- Build fails? Run `npm run build` locally first
- Environment variable issues? Make sure OPENAI_API_KEY is set in Vercel dashboard
- Need help? Check [vercel.com/docs](https://vercel.com/docs)
