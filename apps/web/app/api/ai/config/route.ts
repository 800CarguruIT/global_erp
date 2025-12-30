import { NextRequest, NextResponse } from "next/server";
import { getSql } from "@repo/ai-core";

type ModulePayload = {
  key: string;
  enabled: boolean;
};

const defaultModules = [
  {
    key: "translator",
    label: "AI Translator",
    category: "communication",
    description: "Translate content across languages for SMS, email, chat, and calls.",
    enabled: true,
  },
  {
    key: "dialer",
    label: "Dialer AI",
    category: "call-center",
    description: "Call assistant, transcripts, summaries, and follow-ups for voice.",
    enabled: true,
  },
  {
    key: "voice_ai",
    label: "AI Voice",
    category: "call-center",
    description: "Outbound/Inbound calling, customer callbacks, feedback, internal follow-ups.",
    enabled: true,
  },
  {
    key: "workflow_automation",
    label: "AI Automation",
    category: "automation",
    description: "Automate workflows, routing, and tasks across modules.",
    enabled: true,
  },
  {
    key: "staff_copilot",
    label: "Staff Copilot",
    category: "guidance",
    description: "In-app guidance, navigation help, and workflow assistance for staff.",
    enabled: true,
  },
  {
    key: "inline_translation",
    label: "Inline Translation",
    category: "communication",
    description: "Quick translate box near chat/call center for live conversations.",
    enabled: true,
  },
  {
    key: "documents",
    label: "Document AI",
    category: "productivity",
    description: "Drafting, summaries, reviews, and compliance checks for documents.",
    enabled: true,
  },
];

export async function GET() {
  try {
    const sql = getSql();

    // Ensure global config exists
    await sql`
      INSERT INTO ai_global_config (master_enabled)
      SELECT true WHERE NOT EXISTS (SELECT 1 FROM ai_global_config)
    `;

    // Seed default modules if missing
    for (const m of defaultModules) {
      await sql`
        INSERT INTO ai_modules (key, label, category, description, global_enabled)
        VALUES (${m.key}, ${m.label}, ${m.category}, ${m.description}, ${m.enabled})
        ON CONFLICT (key) DO NOTHING
      `;
    }

    const [globalConfig] = await sql<{ master_enabled: boolean }[]>`
      SELECT master_enabled
      FROM ai_global_config
      ORDER BY id
      LIMIT 1
    `;

    const modules = await sql<
      { key: string; label: string; category: string; description: string | null; global_enabled: boolean }[]
    >`
      SELECT key, label, category, description, global_enabled
      FROM ai_modules
      ORDER BY key
    `;

    const mapped = modules.map((m) => ({
      key: m.key,
      label: m.label,
      category: m.category,
      description: m.description,
      enabled: m.global_enabled,
    }));

    return NextResponse.json({
      masterEnabled: globalConfig?.master_enabled ?? true,
      modules: mapped.length ? mapped : defaultModules,
    });
  } catch (error) {
    console.error("GET /api/ai/config error:", error);
    // Fall back to defaults so the UI can render even if the tables are not migrated yet
    return NextResponse.json({
      masterEnabled: true,
      modules: [],
      error: "Failed to load AI configuration",
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      masterEnabled?: boolean;
      modules?: ModulePayload[];
    };

    const sql = getSql();

    await sql.begin(async (tx) => {
      if (typeof body.masterEnabled === "boolean") {
        await tx`
          UPDATE ai_global_config
          SET master_enabled = ${body.masterEnabled}, updated_at = now()
        `;
      }

      // Upsert new modules with metadata if provided
      const newModules = Array.isArray((body as any).newModules) ? (body as any).newModules : [];
      for (const nm of newModules) {
        if (!nm?.key || !nm?.label) continue;
        await tx`
          INSERT INTO ai_modules (key, label, category, description, global_enabled)
          VALUES (${nm.key}, ${nm.label}, ${nm.category ?? "custom"}, ${nm.description ?? null}, ${nm.enabled ?? true})
          ON CONFLICT (key) DO UPDATE
          SET
            label = EXCLUDED.label,
            category = EXCLUDED.category,
            description = EXCLUDED.description,
            global_enabled = EXCLUDED.global_enabled,
            updated_at = now()
        `;
      }

      if (Array.isArray(body.modules)) {
        for (const m of body.modules) {
          if (!m || typeof m.key !== "string") continue;
          if (typeof m.enabled !== "boolean") continue;

          await tx`
            UPDATE ai_modules
            SET global_enabled = ${m.enabled}, updated_at = now()
            WHERE key = ${m.key}
          `;
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/ai/config error:", error);
    return NextResponse.json(
      { error: "Failed to save AI configuration" },
      { status: 500 }
    );
  }
}
