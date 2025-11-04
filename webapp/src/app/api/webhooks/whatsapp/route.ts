import { NextResponse } from "next/server";
import OpenAI from "openai";
import { twiml, validateRequest } from "twilio";
import {
  AgentConfig,
  AgentConfigSchema,
  ConversationMessage,
  buildSystemPrompt,
  mapToneToTemperature,
} from "@/lib/agent";

type SessionMap = Map<string, ConversationMessage[]>;

const globalWithSessions = globalThis as typeof globalThis & {
  _agentSessions?: SessionMap;
};

const sessionStore: SessionMap =
  globalWithSessions._agentSessions ?? new Map<string, ConversationMessage[]>();

if (!globalWithSessions._agentSessions) {
  globalWithSessions._agentSessions = sessionStore;
}

const fallbackConfig: AgentConfig = {
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
  callToAction: "Proposer un créneau pour une démo en visio de 20 minutes avec un expert.",
  language: "fr",
};

function buildConfigFromEnv(): AgentConfig {
  const rawQuestions =
    process.env.AGENT_QUALIFICATION_POINTS ??
    fallbackConfig.qualificationQuestions.join(" || ");

  const envCandidate = {
    companyName: process.env.AGENT_COMPANY_NAME ?? fallbackConfig.companyName,
    valueProposition:
      process.env.AGENT_VALUE_PROPOSITION ?? fallbackConfig.valueProposition,
    targetProfile:
      process.env.AGENT_TARGET_PROFILE ?? fallbackConfig.targetProfile,
    tone: (process.env.AGENT_TONE as AgentConfig["tone"]) ?? fallbackConfig.tone,
    qualificationQuestions: rawQuestions
      .split("||")
      .map((entry) => entry.trim())
      .filter(Boolean),
    closingStrategy:
      process.env.AGENT_CLOSING_STRATEGY ?? fallbackConfig.closingStrategy,
    callToAction:
      process.env.AGENT_CALL_TO_ACTION ?? fallbackConfig.callToAction,
    language:
      (process.env.AGENT_LANGUAGE as AgentConfig["language"]) ??
      fallbackConfig.language,
  };

  try {
    return AgentConfigSchema.parse(envCandidate);
  } catch {
    return fallbackConfig;
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ready",
    info: "POST Twilio webhook payloads to this endpoint.",
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY manquante." },
      { status: 500 },
    );
  }

  if (!process.env.TWILIO_AUTH_TOKEN) {
    return NextResponse.json(
      { error: "TWILIO_AUTH_TOKEN manquant pour valider la signature Twilio." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("x-twilio-signature") ?? "";
  const bodyText = await request.text();
  const searchParams = new URLSearchParams(bodyText);
  const payload = Object.fromEntries(searchParams.entries());

  const validationUrl =
    process.env.WHATSAPP_WEBHOOK_URL?.trim() || request.url;

  const isValid = validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    signature,
    validationUrl,
    payload,
  );

  if (!isValid) {
    return NextResponse.json({ error: "Signature Twilio invalide." }, { status: 401 });
  }

  const incomingMessage = (payload.Body ?? "").trim();
  const from = payload.From ?? "unknown-sender";

  if (!incomingMessage) {
    const emptyResponse = new twiml.MessagingResponse();
    emptyResponse.message("Merci pour votre message. Pouvez-vous préciser votre demande ?");
    return new Response(emptyResponse.toString(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }

  const config = buildConfigFromEnv();
  const sessionHistory =
    sessionStore.get(from) ??
    ([
      {
        role: "assistant" as const,
        content: `Bonjour ! Je suis ${config.companyName}. Comment puis-je vous aider aujourd'hui ?`,
      },
    ] satisfies ConversationMessage[]);
  const updatedHistory: ConversationMessage[] = [
    ...sessionHistory,
    { role: "user", content: incomingMessage },
  ];

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: mapToneToTemperature(config.tone),
      messages: [
        { role: "system", content: buildSystemPrompt(config) },
        ...updatedHistory.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      max_tokens: 320,
      presence_penalty: 0,
      frequency_penalty: 0.3,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ??
      "Je vous remercie pour votre message. Pourriez-vous reformuler ?";

    const twilioResponse = new twiml.MessagingResponse();
    twilioResponse.message(reply);

    const assistantTurn: ConversationMessage = {
      role: "assistant",
      content: reply,
    };

    sessionStore.set(from, [...updatedHistory, assistantTurn].slice(-20));

    return new Response(twilioResponse.toString(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (unknownError) {
    console.error("[whatsapp-webhook] AI generation failed", unknownError);
    const failResponse = new twiml.MessagingResponse();
    failResponse.message(
      "Nous rencontrons un léger contretemps technique. Un conseiller reprendra la conversation très vite.",
    );
    return new Response(failResponse.toString(), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}
