"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type LocalMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

type ConfigState = {
  companyName: string;
  valueProposition: string;
  targetProfile: string;
  tone: "concis" | "consultatif" | "enthousiaste" | "premium";
  qualificationQuestions: string[];
  closingStrategy: string;
  callToAction: string;
  language: "fr" | "en";
};

const STORAGE_KEY = "closerflow-agent-config";

const defaultConfig: ConfigState = {
  companyName: "NovaSales",
  valueProposition:
    "Solution CRM tout-en-un pour automatiser vos ventes B2B et augmenter votre taux de conversion de 35%.",
  targetProfile:
    "Dirigeants de PME (10-100 employés) dans les services et le e-commerce, déjà équipés d'un CRM basique mais insatisfaits.",
  tone: "consultatif",
  qualificationQuestions: [
    "Quel est aujourd'hui votre principal défi commercial au quotidien ?",
    "Combien de commerciaux travaillent sur vos prospects chaque mois ?",
    "Quelle solution utilisez-vous actuellement et qu'est-ce qui vous manque le plus ?",
  ],
  closingStrategy:
    "Positionner l'offre comme la solution évidente, proposer une démonstration personnalisée et souligner la valeur immédiate.",
  callToAction:
    "Proposer un créneau pour une démo en visio de 20 minutes avec un expert.",
  language: "fr",
};

const toneLabels: Record<ConfigState["tone"], string> = {
  concis: "Direct & efficace",
  consultatif: "Consultatif & rassurant",
  enthousiaste: "Énergique & émotionnel",
  premium: "Haut de gamme & exclusif",
};

const autoresetMessage: LocalMessage = {
  role: "assistant",
  content:
    "Bonjour ! Je suis l'agent WhatsApp NovaSales. Dites-m'en un peu plus sur votre situation commerciale actuelle.",
  createdAt: new Date().toISOString(),
};

export default function Home() {
  const [config, setConfig] = useState<ConfigState>(defaultConfig);
  const [messages, setMessages] = useState<LocalMessage[]>([autoresetMessage]);
  const [userDraft, setUserDraft] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return;
      }
      const parsed = JSON.parse(stored) as ConfigState;
      setConfig((prev) => ({
        ...prev,
        ...parsed,
        qualificationQuestions:
          parsed.qualificationQuestions?.length > 0
            ? parsed.qualificationQuestions
            : prev.qualificationQuestions,
      }));
    } catch {
      // Ignore corrupted payload.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  const qualificationCount = useMemo(
    () => config.qualificationQuestions.length,
    [config.qualificationQuestions.length],
  );

  const handleConfigChange = <K extends keyof ConfigState>(
    key: K,
    value: ConfigState[K],
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleQuestionChange = (value: string, index: number) => {
    setConfig((prev) => {
      const copy = [...prev.qualificationQuestions];
      copy[index] = value;
      return { ...prev, qualificationQuestions: copy };
    });
  };

  const addQuestion = () => {
    setConfig((prev) => ({
      ...prev,
      qualificationQuestions: [...prev.qualificationQuestions, ""],
    }));
  };

  const removeQuestion = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      qualificationQuestions: prev.qualificationQuestions.filter(
        (_, idx) => idx !== index,
      ),
    }));
  };

  const resetConversation = () => {
    setMessages([{
      ...autoresetMessage,
      createdAt: new Date().toISOString(),
      content: autoresetMessage.content.replace("NovaSales", config.companyName),
    }]);
    setError(null);
  };

  const handleSimulate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = userDraft.trim();
    if (!trimmed || isSimulating) {
      return;
    }
    const userMessage: LocalMessage = {
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    const optimisticMessages = [...messages, userMessage];
    setMessages(optimisticMessages);
    setUserDraft("");
    setIsSimulating(true);
    setError(null);

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          config,
          conversation: optimisticMessages.map(({ role, content }) => ({
            role,
            content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("La simulation a échoué. Vérifiez la clé OpenAI côté serveur.");
      }

      const data = (await response.json()) as { reply: string };
      const assistantMessage: LocalMessage = {
        role: "assistant",
        content: data.reply,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur inattendue est survenue.",
      );
    } finally {
      setIsSimulating(false);
    }
  };

  const exportEnv = () => {
    const lines = [
      `# Agent WhatsApp ${config.companyName}`,
      `AGENT_COMPANY_NAME="${config.companyName}"`,
      `AGENT_VALUE_PROPOSITION="${config.valueProposition}"`,
      `AGENT_TARGET_PROFILE="${config.targetProfile}"`,
      `AGENT_TONE=${config.tone}`,
      `AGENT_QUALIFICATION_POINTS="${config.qualificationQuestions.join(" || ")}"`,
      `AGENT_CLOSING_STRATEGY="${config.closingStrategy}"`,
      `AGENT_CALL_TO_ACTION="${config.callToAction}"`,
      `AGENT_LANGUAGE=${config.language}`,
      `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886`,
      `TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
      `TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`,
      `WHATSAPP_WEBHOOK_URL=https://agentic-06f915e2.vercel.app/api/webhooks/whatsapp`,
      `OPENAI_MODEL=gpt-4o-mini`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const downloadUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "agent-whatsapp.env";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white">
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 sm:px-10 lg:px-16">
        <header className="space-y-6">
          <p className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white/80 backdrop-blur">
            Agent IA WhatsApp
          </p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
            Automatisez la qualification & le closing de vos prospects sur WhatsApp.
          </h1>
          <p className="max-w-2xl text-lg text-white/80 sm:text-xl">
            Configurez votre agent conversationnel, pilotez son script et testez la qualité
            des échanges avant de le brancher à votre WhatsApp Business. Aucun code requis.
          </p>
          <div className="grid gap-4 text-sm text-white/70 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <h2 className="text-base font-semibold text-white">Qualification dynamique</h2>
              <p>Personalise les questions selon le profil et détecte les prospects à fort potentiel.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <h2 className="text-base font-semibold text-white">Argumentaire intelligent</h2>
              <p>Reprend vos bénéfices clés et traite les objections en temps réel.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <h2 className="text-base font-semibold text-white">Closing automatisé</h2>
              <p>Propose le prochain pas tangible : démo, paiement ou prise de rendez-vous.</p>
            </div>
          </div>
        </header>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-24 sm:px-10 lg:grid-cols-[1.15fr_0.85fr] lg:px-16">
        <div className="space-y-10 rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur sm:p-8">
          <div>
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-white">
                1. Paramétrez votre agent
              </h2>
              <button
                onClick={exportEnv}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/20"
              >
                Exporter .env
              </button>
            </div>
            <p className="mt-2 text-sm text-white/70">
              Définissez l&apos;ADN de votre agent : identité, cible, ton et call-to-action final.
            </p>
          </div>

          <div className="grid gap-6">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide text-white/70">
                Nom de votre marque
              </span>
              <input
                value={config.companyName}
                onChange={(event) =>
                  handleConfigChange("companyName", event.target.value)
                }
                className="rounded-2xl border border-white/15 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-white/40"
                placeholder="Ex : NovaSales"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide text-white/70">
                Proposition de valeur
              </span>
              <textarea
                value={config.valueProposition}
                onChange={(event) =>
                  handleConfigChange("valueProposition", event.target.value)
                }
                className="min-h-[120px] rounded-2xl border border-white/15 bg-slate-900/60 px-4 py-3 text-sm leading-relaxed text-white outline-none transition placeholder:text-white/40 focus:border-white/40"
                placeholder="Résumez l'offre, les preuves et le différenciateur."
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide text-white/70">
                Profil cible
              </span>
              <textarea
                value={config.targetProfile}
                onChange={(event) =>
                  handleConfigChange("targetProfile", event.target.value)
                }
                className="min-h-[100px] rounded-2xl border border-white/15 bg-slate-900/60 px-4 py-3 text-sm leading-relaxed text-white outline-none transition placeholder:text-white/40 focus:border-white/40"
                placeholder="Précisez la typologie de prospects visés, leurs enjeux et critères de qualification."
              />
            </label>

            <div className="grid gap-4">
              <span className="text-sm font-semibold uppercase tracking-wide text-white/70">
                Ton de l&apos;agent
              </span>
              <div className="grid gap-3 sm:grid-cols-2">
                {(Object.keys(toneLabels) as ConfigState["tone"][]).map((toneKey) => (
                  <button
                    key={toneKey}
                    onClick={() => handleConfigChange("tone", toneKey)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                      config.tone === toneKey
                        ? "border-white bg-white/20 text-white"
                        : "border-white/15 bg-slate-900/50 text-white/70 hover:border-white/40 hover:text-white"
                    }`}
                    type="button"
                  >
                    <strong className="block font-semibold text-white">
                      {toneLabels[toneKey]}
                    </strong>
                    <span className="text-xs text-white/70">
                      {toneKey === "concis" && "Idéal pour les prospects pressés."}
                      {toneKey === "consultatif" &&
                        "Accompagnement en profondeur, posture experte."}
                      {toneKey === "enthousiaste" &&
                        "Met l'accent sur l'énergie, parfait pour le B2C."}
                      {toneKey === "premium" &&
                        "Positionnement haut de gamme, exclusivité maîtrisée."}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-white/70">
                  Questions de qualification ({qualificationCount})
                </span>
                <button
                  onClick={addQuestion}
                  type="button"
                  className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:bg-white/20"
                >
                  Ajouter
                </button>
              </div>
              <div className="grid gap-3">
                {config.qualificationQuestions.map((question, index) => (
                  <div
                    key={`question-${index}`}
                    className="flex items-start gap-3 rounded-2xl border border-white/15 bg-slate-900/60 px-4 py-3"
                  >
                    <span className="mt-1 text-xs font-semibold text-white/50">
                      Q{index + 1}
                    </span>
                    <textarea
                      value={question}
                      onChange={(event) =>
                        handleQuestionChange(event.target.value, index)
                      }
                      className="h-full min-h-[60px] flex-1 resize-none bg-transparent text-sm text-white outline-none placeholder:text-white/40"
                      placeholder="Posez une question critique pour qualifier le prospect."
                    />
                    {config.qualificationQuestions.length > 1 && (
                      <button
                        onClick={() => removeQuestion(index)}
                        className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/40 transition hover:text-red-300"
                        type="button"
                      >
                        Retirer
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide text-white/70">
                Stratégie de closing
              </span>
              <textarea
                value={config.closingStrategy}
                onChange={(event) =>
                  handleConfigChange("closingStrategy", event.target.value)
                }
                className="min-h-[120px] rounded-2xl border border-white/15 bg-slate-900/60 px-4 py-3 text-sm leading-relaxed text-white outline-none transition placeholder:text-white/40 focus:border-white/40"
                placeholder="Décrivez comment l'agent doit présenter l'offre, gérer les objections et conclure."
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide text-white/70">
                Call-to-action final
              </span>
              <input
                value={config.callToAction}
                onChange={(event) =>
                  handleConfigChange("callToAction", event.target.value)
                }
                className="rounded-2xl border border-white/15 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-white/40"
                placeholder="Ex : Envoyer un lien de paiement ou proposer un créneau."
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide text-white/70">
                Langue principale
              </span>
              <select
                value={config.language}
                onChange={(event) =>
                  handleConfigChange(
                    "language",
                    event.target.value as ConfigState["language"],
                  )
                }
                className="rounded-2xl border border-white/15 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none transition focus:border-white/40"
              >
                <option value="fr" className="bg-slate-900">
                  Français
                </option>
                <option value="en" className="bg-slate-900">
                  Anglais
                </option>
              </select>
            </label>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  2. Testez la conversation
                </h2>
                <p className="mt-1 text-sm text-white/70">
                  Validez la qualité du discours avant la mise en production WhatsApp.
                </p>
              </div>
              <button
                onClick={resetConversation}
                className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:bg-white/20"
              >
                Réinitialiser
              </button>
            </div>

            <div className="mt-6 flex max-h-[540px] flex-col gap-4 overflow-y-auto pr-1">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${message.createdAt}-${index}`}
                  className={`flex ${message.role === "assistant" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[82%] rounded-3xl px-4 py-3 text-sm leading-relaxed shadow-lg ${
                      message.role === "assistant"
                        ? "rounded-bl-md bg-white/90 text-slate-900"
                        : "rounded-br-md bg-emerald-500/90 text-white"
                    }`}
                  >
                    <p>{message.content}</p>
                    <span className="mt-2 block text-[10px] uppercase tracking-wide opacity-60">
                      {new Date(message.createdAt).toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleSimulate}
              className="mt-6 flex gap-3 rounded-2xl border border-white/15 bg-slate-900/60 p-3"
            >
              <input
                value={userDraft}
                onChange={(event) => setUserDraft(event.target.value)}
                placeholder="Écrivez la réponse du prospect..."
                className="h-12 flex-1 rounded-xl bg-transparent px-3 text-sm text-white outline-none"
              />
              <button
                type="submit"
                disabled={isSimulating}
                className="h-12 rounded-xl bg-emerald-500 px-5 text-sm font-semibold uppercase tracking-wide text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/60"
              >
                {isSimulating ? "Génération..." : "Envoyer"}
              </button>
            </form>
            {error && (
              <p className="mt-3 text-sm text-red-300">
                {error}
              </p>
            )}
          </div>

          <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-slate-900/80 via-slate-900/30 to-slate-900/80 p-6 backdrop-blur sm:p-8">
            <h2 className="text-xl font-semibold text-white">
              3. Mettez en production sur WhatsApp
            </h2>
            <p className="mt-2 text-sm text-white/70">
              Utilisez les variables d&apos;environnement exportées et suivez la feuille de route ci-dessous.
            </p>
            <ol className="mt-6 space-y-4 text-sm text-white/80">
              <li>
                <strong className="text-white">Connectez Twilio WhatsApp.</strong>{" "}
                Activez le sandbox WhatsApp depuis votre console Twilio et remplacez les identifiants dans le fichier `.env`.
              </li>
              <li>
                <strong className="text-white">Déployez cet agent sur Vercel.</strong>{" "}
                Ajoutez vos variables d&apos;environnement puis reliez l&apos;URL publique au webhook Twilio.
              </li>
              <li>
                <strong className="text-white">Testez en conditions réelles.</strong>{" "}
                Envoyez un message depuis WhatsApp et vérifiez la qualité des réponses directement depuis cette interface.
              </li>
            </ol>
            <p className="mt-6 text-xs uppercase tracking-wide text-white/40">
              Astuce : gardez le ton et la longueur des messages alignés avec votre marque en ajustant la configuration.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
