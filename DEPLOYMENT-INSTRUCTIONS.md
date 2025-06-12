# WellDiary - Kompletní návod k deploymentu

## Rychlý přehled problému
Vaše aplikace zobrazuje build kód místo webové stránky, protože je navržena jako fullstack aplikace (React + Express), ale hosting platformy očekávají různé architektury.

## Řešení podle platformy

### 1. VERCEL (Nejjednodušší pro tento typ aplikace)

**Kroky:**
1. Připojte Git repository k Vercel
2. V Vercel dashboard nastavte Environment Variables:
   ```
   DATABASE_URL=your_postgresql_connection_string
   HUGGINGFACE_API_KEY=your_key (volitelné)
   ANTHROPIC_API_KEY=your_key (volitelné)
   NODE_ENV=production
   ```
3. Build Settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

**Vercel automaticky použije vercel.json konfiguraci z vašeho projektu.**

### 2. RENDER (Doporučeno pro fullstack aplikace)

**Kroky:**
1. Vytvořte Web Service na Render
2. Nastavení:
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Environment: Node.js
3. Environment Variables (stejné jako u Vercel)

### 3. RAILWAY

**Kroky:**
1. Připojte Git repository
2. Railway automaticky detekuje Node.js
3. Nastavte environment variables v dashboard
4. Deploy se spustí automaticky

### 4. NETLIFY (Vyžaduje úpravu)

**Pro Netlify potřebujete přepsat backend na Netlify Functions.**

## Databáze setup

**Doporučené databázové služby:**
1. **Neon** (neon.tech) - PostgreSQL kompatibilní
2. **Supabase** - PostgreSQL s dodatečnými funkcemi
3. **PlanetScale** - MySQL kompatibilní (vyžaduje úpravu schema)

## Po nasazení

1. Spusťte migrace: `npm run db:push`
2. Naplňte testovací data: `npm run db:seed`
3. Otestujte endpoint: `https://your-domain.com/api/health`

## Častí problém: Zobrazuje se build kód

**Příčina:** Nesprávná konfigurace routing nebo build procesu.

**Řešení:**
1. Ověřte, že `vercel.json` nebo ekvivalentní konfigurace je správná
2. Zkontrolujte, že build vytváří `dist` složku s HTML soubory
3. Ujistěte se, že API routes jsou správně nakonfigurovány

## Environment Variables template

```bash
# Povinné
DATABASE_URL=postgresql://user:password@host:port/database

# Volitelné (aplikace funguje i bez nich)
HUGGINGFACE_API_KEY=your_huggingface_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
NODE_ENV=production
```

## Testování deployment

Po úspěšném nasazení navštivte:
- `https://your-domain.com` - Frontend aplikace
- `https://your-domain.com/api/health` - API health check
- `https://your-domain.com/api/user` - Test autentizace (mělo by vrátit 401)

Pokud vše funguje, měli byste vidět login stránku aplikace.