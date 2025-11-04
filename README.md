# CloserFlow AI

Agent conversationnel WhatsApp pour qualifier et closer vos prospects automatiquement.

## Structure

- `webapp/` – Application Next.js (App Router) orientée Vercel avec interface de configuration, simulateur et webhooks Twilio.

## Démarrage rapide

```bash
cd webapp
npm install
npm run dev
```

Lui rendre accessible sur `http://localhost:3000`.

## Variables d'environnement principales

| Nom | Description |
| --- | --- |
| `OPENAI_API_KEY` | Clé API OpenAI utilisée pour la génération de réponses. |
| `OPENAI_MODEL` | (Optionnel) Modèle OpenAI, par défaut `gpt-4o-mini`. |
| `TWILIO_ACCOUNT_SID` | Identifiant du compte Twilio WhatsApp Business. |
| `TWILIO_AUTH_TOKEN` | Jeton Twilio pour vérifier les signatures webhook. |
| `TWILIO_WHATSAPP_FROM` | Numéro WhatsApp Twilio au format `whatsapp:+` |
| `WHATSAPP_WEBHOOK_URL` | URL publique de l'endpoint `/api/webhooks/whatsapp`. |
| `AGENT_COMPANY_NAME` etc. | Paramètres agent si vous souhaitez forcer une configuration côté serveur. |

Ajoutez ces valeurs dans un fichier `.env.local` ou sur Vercel.

## Déploiement Vercel

```bash
npm run build
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-06f915e2
```

Après propagation DNS :

```bash
curl https://agentic-06f915e2.vercel.app
```

## Webhook WhatsApp

1. Configurez le Sandbox ou l'API officielle WhatsApp dans Twilio.
2. Renseignez l'URL de webhook (`https://agentic-06f915e2.vercel.app/api/webhooks/whatsapp`) et exportez les variables d'environnement.
3. Les échanges sont enrichis via OpenAI et mémorisés en mémoire durant la vie du processus.

## Licence

MIT
