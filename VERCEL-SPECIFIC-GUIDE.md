# Vercel Deployment - Krok za krokem

## Aktuální chyby a jejich řešení

### 1. Node.js Version Error
✅ **Opraveno** - Přidány soubory `.node-version` a `.nvmrc`

### 2. Runtime Error
✅ **Opraveno** - Aktualizována `vercel.json` s správnou runtime verzí

## Vercel Project Settings

1. **V Vercel Dashboard** → Settings → General:
   - Node.js Version: **18.x**

2. **Build & Development Settings**:
   - Framework Preset: **Other**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Environment Variables**:
   ```
   DATABASE_URL=postgresql://user:pass@host:port/db
   NODE_ENV=production
   HUGGINGFACE_API_KEY=optional_key
   ANTHROPIC_API_KEY=optional_key
   ```

## Expected Result
Po správném nastavení by měla aplikace:
- Frontend běžet na hlavní doméně
- API endpoint `/api/health` vracet JSON response
- Zobrazit login stránku místo build kódu

## Pokud Vercel stále nefunguje

Doporučuji přepnout na **Render.com**:
- Automaticky detekuje Node.js verzi
- Jednodušší konfigurace pro fullstack aplikace
- Spolehlivější pro Express.js servery