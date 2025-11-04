import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  SimulatePayloadSchema,
  buildSystemPrompt,
  mapToneToTemperature,
} from "@/lib/agent";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY manquante dans les variables d'environnement." },
      { status: 500 },
    );
  }

  let payload;
  try {
    const raw = await request.json();
    payload = SimulatePayloadSchema.parse(raw);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Payload invalide pour la simulation.",
        details: error instanceof Error ? error.message : error,
      },
      { status: 400 },
    );
  }

  const { config, conversation } = payload;
  const systemPrompt = buildSystemPrompt(config);

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      temperature: mapToneToTemperature(config.tone),
      messages: [
        { role: "system", content: systemPrompt },
        ...conversation.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      max_tokens: 320,
      presence_penalty: 0,
      frequency_penalty: 0.2,
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ??
      "Je n'ai pas pu générer de réponse pour le moment.";

    return NextResponse.json({ reply });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Erreur lors de l'appel OpenAI.",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 },
    );
  }
}
