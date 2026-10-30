# Trezo — Compta & patrimoine

App web/mobile (PWA) de suivi financier global : comptes bancaires et crypto multi-devises, compte courant suivi au mois, revenus et charges fixes, placements, patrimoine net et compta de l'agence.

## Stack

- Vite + React + TypeScript, Tailwind CSS v4, Recharts, zustand
- Supabase (auth + table `records` protégée par RLS, une ligne par objet)
- Hébergement Netlify (`netlify.toml`), installable comme app (PWA)

## Développement

```bash
npm install
npm run dev          # http://localhost:5173
```

`?local` dans l'URL (ex. `http://localhost:5173/?local`) lance l'app sans compte, avec les données stockées dans le navigateur.

## Supabase

- `supabase/migrations/001_init.sql` : schéma, RLS, liste d'inscription sur invitation.
- `supabase/functions/signup` : fonction d'inscription (vérifie le code d'invitation).
- Le code d'invitation et le nombre max de comptes sont dans `private.app_config` (à modifier depuis l'éditeur SQL, jamais dans le code).

Variables optionnelles : `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (clé publishable).

## Netlify

Build `npm run build`, dossier publié `dist`. La fonction planifiée `netlify/functions/keepalive.mjs` interroge Supabase une fois par jour pour éviter la mise en pause du projet gratuit après 7 jours sans activité.
