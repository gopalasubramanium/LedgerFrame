import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders the AI's / briefing markdown as clean, theme-aware rich text: headings,
// bold/italics, lists, links and GitHub-flavoured tables. Kept compact so answers
// stay readable inside cards. (No raw HTML is allowed — react-markdown escapes it.)
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`lf-md text-ink leading-relaxed ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...p }) => <h3 className="text-base font-semibold mt-3 mb-1 first:mt-0" {...p} />,
          h2: ({ node, ...p }) => <h3 className="text-base font-semibold mt-3 mb-1 first:mt-0" {...p} />,
          h3: ({ node, ...p }) => <h4 className="text-sm font-semibold uppercase tracking-wide text-faint mt-3 mb-1 first:mt-0" {...p} />,
          p: ({ node, ...p }) => <p className="mb-2 last:mb-0" {...p} />,
          ul: ({ node, ...p }) => <ul className="list-disc pl-5 mb-2 space-y-0.5" {...p} />,
          ol: ({ node, ...p }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5" {...p} />,
          li: ({ node, ...p }) => <li className="marker:text-faint" {...p} />,
          strong: ({ node, ...p }) => <strong className="font-semibold text-ink" {...p} />,
          em: ({ node, ...p }) => <em className="italic" {...p} />,
          a: ({ node, ...p }) => <a className="text-accent hover:underline" target="_blank" rel="noreferrer" {...p} />,
          blockquote: ({ node, ...p }) => <blockquote className="border-l-2 border-line pl-3 text-muted italic my-2" {...p} />,
          code: ({ node, ...p }) => <code className="bg-elevated rounded px-1 py-0.5 text-[0.85em] tnum" {...p} />,
          hr: () => <hr className="border-line/60 my-3" />,
          table: ({ node, ...p }) => <div className="overflow-x-auto my-2"><table className="w-full text-sm border-collapse" {...p} /></div>,
          thead: ({ node, ...p }) => <thead className="text-faint text-xs uppercase" {...p} />,
          th: ({ node, ...p }) => <th className="text-left font-semibold border-b border-line py-1 pr-3" {...p} />,
          td: ({ node, ...p }) => <td className="border-b border-line/50 py-1 pr-3 tnum" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
