# Node 414 - Digital Bathroom Stall

A retro-terminal themed anonymous message board for Michigan State University students, designed for Lyft rides. Features an analog glitch aesthetic with CRT-style overlays and terminal animations.

## Features

- 🖥️ **Retro Terminal UI** - Authentic CRT monitor aesthetic with scan lines and glitch effects
- 📝 **Anonymous Messaging** - Leave messages for future passengers
- ⬆️ **Upvote System** - "Vouch" for messages you like
- 🔄 **Real-time Updates** - See new messages instantly
- 📱 **Mobile Optimized** - Perfect for QR code access in vehicles

## Tech Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Real-time subscriptions)
- **Icons**: Lucide React
- **Deployment**: Vercel

## Setup Instructions

### 1. Clone and Install

```bash
git clone <your-repo>
cd node414
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the contents of `supabase-schema.sql`
3. Copy your project URL and anon key from Settings > API

### 3. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_ID=vehicle-node-414
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the app.

## Deployment to Vercel

1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## Database Schema

The app uses a single `logs` table:

- `id` - UUID primary key
- `text` - The message content
- `app_id` - App identifier (allows multiple instances)
- `upvotes` - Number of upvotes
- `author_id` - Anonymous user ID
- `created_at` - Timestamp

## Usage

1. **Boot Sequence** - Animated loading screen with progress bar
2. **Main Menu** - Choose to read logs or write new ones
3. **Read Mode** - Browse all messages with upvote capability
4. **Write Mode** - Compose and submit anonymous messages

## Customization

- Change `NEXT_PUBLIC_APP_ID` to create separate instances
- Modify colors in `tailwind.config.js` for different themes
- Adjust boot sequence timing in the main component

## Michigan State University Theme

Perfect for MSU students - the "Lansing Sector" reference and Node 414 designation create an authentic local feel while maintaining the anonymous, ephemeral nature of bathroom stall messages in digital form.
