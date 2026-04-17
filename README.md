# Meal Tracker

A simple mobile-friendly web app to track your meals using Supabase.

## Setup Instructions

1. **Get your Supabase credentials:**
   - Go to your Supabase project dashboard
   - Navigate to Settings > API
   - Copy your Project URL and anon/public key

2. **Configure the app:**
   - Open `app.js`
   - Replace `YOUR_SUPABASE_URL` with your Supabase project URL
   - Replace `YOUR_SUPABASE_ANON_KEY` with your Supabase anon key

3. **Database table setup:**
   Make sure your Supabase table is named `meals` with the following structure:
   - `id` (uuid, primary key, auto-generated)
   - `timestamp` (timestamp, default: now())
   - `description` (text)

4. **Run the app:**
   - Open `index.html` in a web browser
   - Or use a local server (e.g., `python -m http.server` or `npx serve`)

## Features

- Mobile-optimized interface
- Simple meal entry form
- Automatic timestamp recording
- Success/error feedback messages
