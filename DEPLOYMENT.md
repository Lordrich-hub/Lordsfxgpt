# LordsFX - Deployment Guide

This guide will help you deploy LordsFX as a standalone web application that runs 24/7 without your PC.

## Deployment Options

### 1. Vercel (Recommended - Free Tier Available)

Vercel is the easiest option for Next.js applications and offers a generous free tier.

#### Steps:

1. **Create a Vercel Account**
   - Go to [vercel.com](https://vercel.com)
   - Sign up with your GitHub, GitLab, or email

2. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

3. **Login to Vercel**
   ```bash
   vercel login
   ```

4. **Deploy Your App**
   ```bash
   vercel
   ```
   - Follow the prompts
   - When asked about project settings, accept defaults
   - Your app will be deployed with a URL like `your-app.vercel.app`

5. **Add Environment Variables**
   - Go to your project dashboard on Vercel
   - Navigate to Settings > Environment Variables
   - Add: `OPENAI_API_KEY` with your OpenAI API key
   - Redeploy for changes to take effect

6. **Custom Domain (Optional)**
   - Go to Settings > Domains
   - Add your custom domain (e.g., lordsfx.com)
   - Follow DNS configuration instructions

#### Continuous Deployment:
- Push your code to GitHub
- Connect your GitHub repo to Vercel
- Automatic deployments on every push to main branch

---

### 2. Netlify (Alternative Free Option)

#### Steps:

1. **Create Netlify Account**
   - Go to [netlify.com](https://netlify.com)
   - Sign up

2. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

3. **Build Your App**
   ```bash
   npm run build
   ```

4. **Deploy**
   ```bash
   netlify deploy --prod
   ```

5. **Set Environment Variables**
   - Go to Site settings > Build & deploy > Environment
   - Add `OPENAI_API_KEY`

---

### 3. Railway (Easy with Database Support)

Railway offers $5/month free credit and is great for full-stack apps.

#### Steps:

1. **Create Railway Account**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Deploy from GitHub**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Railway auto-detects Next.js and deploys

3. **Add Environment Variables**
   - Go to Variables tab
   - Add `OPENAI_API_KEY`

---

### 4. DigitalOcean App Platform

#### Steps:

1. **Create DigitalOcean Account**
   - Go to [digitalocean.com](https://digitalocean.com)
   - $200 free credit for 60 days with promo

2. **Create App**
   - Go to Apps section
   - Click "Create App"
   - Connect GitHub repository
   - Select your repo and branch

3. **Configure Build**
   - Build Command: `npm run build`
   - Run Command: `npm start`
   - Add environment variable: `OPENAI_API_KEY`

4. **Deploy**
   - Review settings and deploy
   - App will be live at `your-app.ondigitalocean.app`

---

## Before Deploying

### 1. Push Code to GitHub

If you haven't already:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/lordsfx.git
git push -u origin main
```

### 2. Environment Variables

Make sure you have these set in your deployment platform:

- `OPENAI_API_KEY` - Your OpenAI API key from platform.openai.com

If you enable account-based history (recommended for multi-user sharing), also set:

- `DATABASE_URL` - Postgres connection string (Vercel Postgres or any managed Postgres)
- `PRISMA_DATABASE_URL` - Direct (non-pooled) Postgres connection string for Prisma migrations (recommended)
- `NEXTAUTH_SECRET` - Random secret for session encryption
- `NEXTAUTH_URL` - Your site URL (e.g. https://your-app.vercel.app)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth credentials

### 3. Test Locally First

```bash
npm run build
npm start
```

Visit `http://localhost:3000` to ensure everything works.

---

## Recommended: Vercel Deployment

For the easiest deployment:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# When prompted:
# - Set up and deploy? Yes
# - Which scope? Select your account
# - Link to existing project? No
# - What's your project's name? lordsfx
# - In which directory is your code located? ./
# - Want to override the settings? No

# Production deployment
vercel --prod
```

Your app will be live at: `https://lordsfx.vercel.app` (or your custom domain)

---

## Post-Deployment

1. **Test your live site** - Upload a chart and verify it works
2. **Monitor usage** - Check your OpenAI API usage at platform.openai.com
3. **Set up alerts** - Configure email notifications for errors in your platform dashboard
4. **Custom domain** - Add your own domain in platform settings

---

## Troubleshooting

### Build Errors
- Make sure all dependencies are in package.json
- Run `npm install` locally to verify
- Check build logs in your deployment platform

### API Key Issues
- Verify environment variable is set correctly
- No quotes needed in most platforms
- Redeploy after adding variables

### Performance
- Vercel/Netlify have generous free tiers
- For high traffic, consider upgrading to paid tier
- Monitor function execution times

---

## Cost Estimates

### Free Tier Options:
- **Vercel**: 100GB bandwidth/month, unlimited deployments
- **Netlify**: 100GB bandwidth/month, 300 build minutes
- **Railway**: $5/month credit (renews monthly)

### Paid Options (if you exceed free tier):
- **Vercel Pro**: $20/month
- **Railway**: Pay as you go, ~$5-20/month
- **DigitalOcean**: $5/month basic droplet

---

## Support

Need help? Check:
- Vercel docs: [vercel.com/docs](https://vercel.com/docs)
- Next.js deployment: [nextjs.org/docs/deployment](https://nextjs.org/docs/deployment)
- Railway docs: [docs.railway.app](https://docs.railway.app)

Your LordsFX app will be live 24/7 once deployed! 🚀
