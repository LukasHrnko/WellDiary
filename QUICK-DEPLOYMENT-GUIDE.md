# WellDiary - Rychlý návod pro nasazení

## Problém s Vercel
Chyba "Function Runtimes must have a valid version" je způsobena nesprávnou konfigurací. Pro vaši fullstack aplikaci doporučuji:

## Řešení 1: RENDER (Nejjednodušší)

1. Jděte na render.com
2. "New Web Service" → připojte Git repo
3. Nastavení:
   - Build: `npm install && npm run build`
   - Start: `npm start`
   - Environment: Node
4. Přidejte environment variables:
   - `DATABASE_URL` (PostgreSQL connection string)
   - `NODE_ENV=production`

## Řešení 2: RAILWAY

1. Připojte repo na railway.app
2. Automaticky detekuje Node.js
3. Přidejte DATABASE_URL v nastavení
4. Deploy se spustí automaticky

## Řešení 3: Oprava pro Vercel

Současná vercel.json konfigurace by měla fungovat. Pokud stále vidíte chybu:

1. Smažte vercel.json
2. Nechte Vercel automaticky detekovat konfiguraci
3. V Build Settings nastavte:
   - Framework Preset: Other
   - Build Command: `npm run build`
   - Output Directory: `dist`

## Databáze
Pro rychlé testování použijte Neon (neon.tech) - poskytuje PostgreSQL zdarma.

## Po nasazení
Navštivte `/api/health` pro ověření funkčnosti API.