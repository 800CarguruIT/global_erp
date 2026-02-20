import { Fragment, type ReactNode } from "react";

type MarkdownBlock =
    | { type: "heading"; level: number; text: string }
    | { type: "paragraph"; text: string }
    | { type: "list"; ordered: boolean; items: string[] }
    | { type: "code"; language: string; content: string };

interface MarkdownRendererProps {
    text: string;
}

export function MarkdownRenderer({ text }: MarkdownRendererProps) {
    if (!text) {
        return null;
    }

    const blocks = parseMarkdown(text);

    return (
        <div className="space-y-5 text-sm leading-relaxed text-foreground">
            {blocks.map((block, idx) => {
                if (block.type === "heading") {
                    const HeadingTag = block.level === 1 ? "h1" : block.level === 2 ? "h2" : block.level === 3 ? "h3" : "h4";
                    return (
                        <HeadingTag
                            key={`heading-${idx}`}
                            className="text-2xl font-semibold text-foreground"
                        >
                            {renderInlineNodes(block.text)}
                        </HeadingTag>
                    );
                }

                if (block.type === "list") {
                    const ListTag = block.ordered ? "ol" : "ul";
                    const className = "space-y-2 pl-5 text-sm leading-relaxed text-foreground";
                    return (
                        <ListTag key={`list-${idx}`} className={className}>
                            {block.items.map((item, itemIdx) => (
                                <li key={`list-item-${idx}-${itemIdx}`}>{renderInlineNodes(item)}</li>
                            ))}
                        </ListTag>
                    );
                }

                if (block.type === "code") {
                    return (
                        <pre
                            key={`code-${idx}`}
                            className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 text-xs leading-relaxed text-white"
                        >
                            <code data-language={block.language || undefined}>{block.content}</code>
                        </pre>
                    );
                }

                return (
                    <p key={`paragraph-${idx}`} className="text-sm leading-relaxed text-foreground">
                        {renderInlineNodes(block.text)}
                    </p>
                );
            })}
        </div>
    );
}

function parseMarkdown(text: string): MarkdownBlock[] {
    const normalized = text.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    const blocks: MarkdownBlock[] = [];
    let paragraphBuffer: string[] = [];
    let listBuffer: { ordered: boolean; items: string[] } | null = null;
    let codeBuffer: { language: string; lines: string[] } | null = null;

    const flushParagraph = () => {
        if (paragraphBuffer.length === 0) {
            return;
        }

        blocks.push({ type: "paragraph", text: paragraphBuffer.join(" ").trim() });
        paragraphBuffer = [];
    };

    const flushList = () => {
        if (!listBuffer) {
            return;
        }

        blocks.push({ type: "list", ordered: listBuffer.ordered, items: listBuffer.items });
        listBuffer = null;
    };

    const flushCode = () => {
        if (!codeBuffer) {
            return;
        }
        blocks.push({
            type: "code",
            language: codeBuffer.language,
            content: codeBuffer.lines.join("\n"),
        });
        codeBuffer = null;
    };

    for (const raw of lines) {
        const trimmed = raw.trim();

        const fenceMatch = trimmed.match(/^```(.*)$/);
        if (fenceMatch) {
            flushParagraph();
            flushList();
            if (codeBuffer) {
                flushCode();
            } else {
                codeBuffer = {
                    language: (fenceMatch[1] || "").trim().toLowerCase(),
                    lines: [],
                };
            }
            continue;
        }

        if (codeBuffer) {
            codeBuffer.lines.push(raw);
            continue;
        }

        if (trimmed === "") {
            flushParagraph();
            flushList();
            continue;
        }

        const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)/);
        if (headingMatch) {
            flushParagraph();
            flushList();
            blocks.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2].trim() });
            continue;
        }

        const listMatch = trimmed.match(/^(?:([-*+])|(\d+\.))\s+(.*)/);
        if (listMatch) {
            flushParagraph();
            const isOrdered = Boolean(listMatch[2]);
            const entryText = listMatch[3].trim();

            if (!listBuffer || listBuffer.ordered !== isOrdered) {
                flushList();
                listBuffer = { ordered: isOrdered, items: [] };
            }

            listBuffer.items.push(entryText);
            continue;
        }

        paragraphBuffer.push(trimmed);
    }

    flushParagraph();
    flushList();
    flushCode();

    return blocks;
}

function renderInlineNodes(text: string): ReactNode[] {
    const parts = text.split(/(`[^`]+`)/g);

    return parts
        .map((segment, index) => {
            if (!segment) {
                return null;
            }

            if (segment.startsWith("`") && segment.endsWith("`")) {
                return (
                    <code
                        key={`code-${index}`}
                        className="rounded-sm bg-muted-foreground/10 px-1 py-0.5 font-mono text-xs text-muted-foreground"
                    >
                        {segment.slice(1, -1)}
                    </code>
                );
            }

            return (
                <Fragment key={`text-${index}`}>
                    {segment}
                </Fragment>
            );
        })
        .filter(Boolean) as ReactNode[];
}

