# CloserFlow AI – Webapp

Interface Next.js pour piloter l'agent IA WhatsApp de qualification et de closing.

## Installation

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` – Démarrage local avec rechargement.
- `npm run build` – Build de production Next.js.
- `npm run start` – Lancement du build.
- `npm run lint` – Analyse eslint.

## Variables d'environnement

Créez un fichier `.env.local` (non versionné) avec les clés suivantes :

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
WHATSAPP_WEBHOOK_URL=https://agentic-06f915e2.vercel.app/api/webhooks/whatsapp
AGENT_COMPANY_NAME=NovaSales
AGENT_VALUE_PROPOSITION=Solution CRM...
AGENT_TARGET_PROFILE=Dirigeants PME...
AGENT_TONE=consultatif
AGENT_QUALIFICATION_POINTS=Question 1 || Question 2 || Question 3
AGENT_CLOSING_STRATEGY=Met ...
AGENT_CALL_TO_ACTION=Réservez votre démo de 20 minutes
AGENT_LANGUAGE=fr
```

Les différents paramètres peuvent être générés via le bouton `Exporter .env` disponible sur la page d'accueil.

## API Routes

- `POST /api/simulate` – Simule un échange avec OpenAI pour tester la configuration de l'agent.
- `POST /api/webhooks/whatsapp` – Endpoint Twilio WhatsApp qui renvoie un TwiML signé.

## Déploiement

```bash
npm run build
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-06f915e2
```
