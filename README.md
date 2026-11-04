# Cultos · AD Novo Tempo

App web (instalável no celular) para o pastor organizar os cultos da Igreja Evangélica AD Novo Tempo.

## O que faz (Fase 1)
- Calendário do mês com os cultos programados
- Linha do tempo do culto com horários automáticos e barra de tempo preenchido
- 31 tipos de oportunidade + equipe de apoio (fotografia, ceia, ofertas…)
- Harpa Cristã (número e título dos 640 hinos)
- Convites pelo WhatsApp: cada pessoa aceita/recusa, preenche os detalhes e vê a programação completa
- Link do dirigente: organiza somente o culto em que é dirigente
- PDF da programação com a identidade visual da igreja

## Tecnologia
- React + Vite + TypeScript (pasta `src/`)
- Supabase (banco e login). Esquema em `supabase/schema.sql`
- Hospedagem no Netlify (`netlify.toml`)

## Rodar localmente
```bash
npm install
npm run dev
```
As chaves públicas do Supabase ficam em `.env.production` (a chave publishable é pública por natureza).
Para desenvolvimento, crie `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Configurar o banco
No Supabase → SQL Editor, rode **nesta ordem** (cada arquivo inteiro, depois Run):
1. `supabase/schema.sql`
2. `supabase/002_pastor.sql`

Se rodar o `schema.sql` de novo no futuro, rode também os arquivos seguintes depois dele.
A primeira conta criada no app vira a do administrador (pastor).
