import { Fragment, type ReactNode } from "react";

type MarkdownBlock =
    | { type: "heading"; level: number; text: string }
    | { type: "paragraph"; text: string }
    | { type: "list"; ordered: boolean; items: string[] }
    | { type: "table"; headers: string[]; rows: string[][] }
    | { type: "code"; language: string; content: string };

interface MarkdownRendererProps {
    text: string;
}

export function slugifyHeading(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[`*_~]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
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
                    const headingId = slugifyHeading(block.text);
                    const headingClassName =
                        block.level === 1
                            ? "scroll-mt-28 text-3xl font-semibold text-foreground"
                            : block.level === 2
                            ? "scroll-mt-28 text-2xl font-semibold text-foreground"
                            : "scroll-mt-28 text-xl font-semibold text-foreground";
                    return (
                        <HeadingTag
                            key={`heading-${idx}`}
                            id={headingId}
                            className={headingClassName}
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
                            className="overflow-x-auto rounded-xl border border-border bg-black/40 p-4 text-xs leading-relaxed text-white"
                        >
                            <code data-language={block.language || undefined}>{block.content}</code>
                        </pre>
                    );
                }

                if (block.type === "table") {
                    return (
                        <div key={`table-${idx}`} className="overflow-x-auto rounded-xl border border-border bg-black/20">
                            <table className="min-w-full border-collapse text-left text-sm">
                                <thead className="bg-muted/40">
                                    <tr>
                                        {block.headers.map((header, headerIdx) => (
                                            <th
                                                key={`th-${idx}-${headerIdx}`}
                                                className="border-b border-border px-3 py-2 font-semibold text-foreground"
                                            >
                                                {renderInlineNodes(header)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {block.rows.map((row, rowIdx) => (
                                        <tr key={`tr-${idx}-${rowIdx}`} className="border-b border-border last:border-b-0">
                                            {row.map((cell, cellIdx) => (
                                                <td key={`td-${idx}-${rowIdx}-${cellIdx}`} className="px-3 py-2 align-top text-foreground/90">
                                                    {renderInlineNodes(cell)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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

    for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i];
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

        const nextLine = lines[i + 1]?.trim() ?? "";
        const separatorMatch = nextLine.match(/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/);
        const isTableHeader = trimmed.includes("|") && Boolean(separatorMatch);
        if (isTableHeader) {
            flushParagraph();
            flushList();

            const parseTableLine = (line: string) =>
                line
                    .trim()
                    .replace(/^\|/, "")
                    .replace(/\|$/, "")
                    .split("|")
                    .map((cell) => cell.trim());

            const headers = parseTableLine(trimmed);
            const rows: string[][] = [];

            let cursor = i + 2;
            while (cursor < lines.length) {
                const candidate = lines[cursor].trim();
                if (!candidate || !candidate.includes("|")) break;
                rows.push(parseTableLine(candidate));
                cursor += 1;
            }

            blocks.push({ type: "table", headers, rows });
            i = cursor - 1;
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
        .flatMap((segment, index) => {
            if (!segment) {
                return [];
            }

            if (segment.startsWith("`") && segment.endsWith("`")) {
                return [
                    <code
                        key={`code-${index}`}
                        className="rounded-sm bg-muted-foreground/10 px-1 py-0.5 font-mono text-xs text-muted-foreground"
                    >
                        {segment.slice(1, -1)}
                    </code>,
                ];
            }

            const boldParts = segment.split(/(\*\*[^*]+\*\*)/g);
            return boldParts
                .map((part, boldIndex) => {
                    if (!part) {
                        return null;
                    }

                    if (part.startsWith("**") && part.endsWith("**")) {
                        return (
                            <strong key={`strong-${index}-${boldIndex}`} className="font-semibold text-foreground">
                                {part.slice(2, -2)}
                            </strong>
                        );
                    }

                    return <Fragment key={`text-${index}-${boldIndex}`}>{part}</Fragment>;
                })
                .filter(Boolean);
        })
        .filter(Boolean) as ReactNode[];
}

