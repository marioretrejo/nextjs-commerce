import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import type { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { TOOLS, executeTool } from "./_lib/tools";
import { loadCopilotConfig, FALLBACK_SYSTEM_PROMPT } from "./_lib/config";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const groqKey = process.env["GROQ_API_KEY"];
    if (!groqKey) {
      return NextResponse.json({
        reply:
          "El Analytics Copilot no está configurado. Agrega GROQ_API_KEY en las variables de entorno de Vercel.",
      });
    }

    const admin = createAdminClient();

    // Load workspace and copilot config in parallel
    const [wsResult, cfg] = await Promise.all([
      admin.from("workspaces").select("id").eq("owner_id", user.id).single(),
      loadCopilotConfig(admin),
    ]);

    if (!wsResult.data)
      return NextResponse.json({ reply: "No se encontró tu workspace." });
    const workspaceId = (wsResult.data as { id: string }).id;

    if (!cfg.enabled) {
      return NextResponse.json({
        reply: "El Analytics Copilot está deshabilitado por el administrador.",
      });
    }

    const { messages } = (await req.json()) as {
      messages: ChatCompletionMessageParam[];
    };
    const groq = new Groq({ apiKey: groqKey });

    // Build system prompt: use configured prompt (or fallback), then append RAG docs and date
    const basePrompt = cfg.system_prompt.trim() || FALLBACK_SYSTEM_PROMPT;
    const ragSection =
      cfg.rag_documents.length > 0
        ? "\n\n---\n## Knowledge Base\nUse the following documents to answer questions when relevant:\n\n" +
          cfg.rag_documents
            .map((doc) => `### ${doc.title}\n${doc.content}`)
            .join("\n\n")
        : "";
    const systemPrompt = `${basePrompt}${ragSection}\n\n- Today: ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.`;

    const history: ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    // Agentic loop: up to 4 rounds of tool calls
    for (let round = 0; round < 4; round++) {
      let response;
      try {
        response = await groq.chat.completions.create({
          model: cfg.model ?? "llama-3.3-70b-versatile",
          messages: history,
          tools: TOOLS,
          tool_choice: "auto",
          max_tokens: cfg.max_tokens ?? 1024,
          temperature: cfg.temperature ?? 0.3,
        });
      } catch (groqErr) {
        // If tool validation fails, retry this round without tools
        const errStr = String(groqErr);
        if (
          errStr.includes("tool_validation_error") ||
          errStr.includes("tool call validation")
        ) {
          try {
            const fallback = await groq.chat.completions.create({
              model: cfg.model ?? "llama-3.3-70b-versatile",
              messages: history,
              max_tokens: cfg.max_tokens ?? 1024,
              temperature: cfg.temperature ?? 0.3,
            });
            const content = fallback.choices[0]?.message?.content;
            return NextResponse.json({
              reply:
                content ??
                "No pude obtener los datos en este momento. Por favor intenta de nuevo.",
            });
          } catch {
            return NextResponse.json({
              reply:
                "Servicio temporalmente no disponible. Por favor intenta en unos segundos.",
            });
          }
        }
        throw groqErr;
      }

      const choice = response.choices[0];
      if (!choice) break;
      history.push(choice.message);

      // Model finished — return text response
      if (
        choice.finish_reason !== "tool_calls" ||
        !choice.message.tool_calls?.length
      ) {
        const content = choice.message.content;
        return NextResponse.json({
          reply: content ?? "No tengo datos disponibles para responder eso.",
        });
      }

      // Execute all tool calls in parallel
      const toolCalls = choice.message.tool_calls.filter(
        (
          tc,
        ): tc is typeof tc & {
          function: { name: string; arguments: string };
        } => tc.type === "function" && "function" in tc,
      );

      const toolResults = await Promise.all(
        toolCalls.map(async (tc) => {
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          } catch {
            /* ignore */
          }
          return {
            role: "tool" as const,
            tool_call_id: tc.id,
            content: await executeTool(tc.function.name, args, workspaceId),
          };
        }),
      );

      history.push(...toolResults);
    }

    return NextResponse.json({
      reply: "No pude obtener una respuesta. Por favor intenta de nuevo.",
    });
  } catch (e) {
    console.error("[copilot] error:", e);
    return NextResponse.json({
      reply:
        "Ocurrió un error inesperado. Por favor intenta de nuevo en unos segundos.",
    });
  }
}
