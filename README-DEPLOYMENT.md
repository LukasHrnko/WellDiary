# WellDiary - Deployment Guide

## Přehled aplikace
WellDiary je fullstack wellness tracking aplikace s:
- React frontend (TypeScript)
- Express.js backend (Node.js)
- PostgreSQL databáze
- AI funkce (OCR/HTR, analýza dat)

## Deployment možnosti

### 1. Vercel (Doporučeno pro frontend + serverless API)

#### Příprava pro Vercel:
```bash
# 1. Ujistěte se, že máte vercel.json v root složce
# 2. Nastavte environment variables ve Vercel dashboard:
DATABASE_URL=your_postgresql_connection_string
HUGGINGFACE_API_KEY=your_huggingface_api_key (volitelné)
ANTHROPIC_API_KEY=your_anthropic_api_key (volitelné)

# 3. Deploy příkazy
npm run build
vercel
```

### 2. Render (Doporučeno pro fullstack aplikace)

#### Render konfigurace:
- **Service Type**: Web Service
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment**: Node.js

### 3. Railway

#### Railway konfigurace:
- Automaticky detekuje Node.js
- Nastaví environment variables v dashboard
- Build: `npm install && npm run build`
- Start: `npm start`

### 4. DigitalOcean App Platform

#### DO konfigurace:
```yaml
name: welldiary
services:
- name: web
  source_dir: /
  github:
    repo: your-username/your-repo
    branch: main
  run_command: npm start
  environment_slug: node-js
  instance_count: 1
  instance_size_slug: basic-xxs
  envs:
  - key: DATABASE_URL
    value: your_database_url
```

## Environment Variables

Vyžadované:
- `DATABASE_URL`: PostgreSQL connection string

Volitelné:
- `HUGGINGFACE_API_KEY`: Pro vylepšené OCR
- `ANTHROPIC_API_KEY`: Pro AI analýzu
- `NODE_ENV`: production

## Databáze setup

1. **Neon Database** (doporučeno):
   - Vytvořte projekt na neon.tech
   - Získejte connection string
   - Nastavte jako DATABASE_URL

2. **Supabase**:
   - Vytvořte projekt
   - Použijte PostgreSQL connection string

3. **PlanetScale**:
   - Vytvořte databázi
   - Nastavte connection string

## Post-deployment checklist

1. ✅ Databázové schéma: `npm run db:push`
2. ✅ Seed data: `npm run db:seed`
3. ✅ Test API endpoints: `/api/health`
4. ✅ Test frontend funkcionalita
5. ✅ Nastavte custom doménu (volitelné)

## Troubleshooting

### Problém: Zobrazuje se build kód místo aplikace
**Řešení**: Ujistěte se, že:
- `vercel.json` správně konfiguruje routes
- Build outputDirectory je nastaven na `dist`
- Frontend build je úspěšný

### Problém: API endpoints nefungují
**Řešení**:
- Zkontrolujte environment variables
- Ověřte databázové připojení
- Zkontrolujte logs v deployment dashboard

### Problém: OCR/AI funkce nefungují
**Řešení**:
- Nastavte API klíče v environment variables
- Fallback funguje i bez API klíčů (základní OCR)