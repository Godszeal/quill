export function RichText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-3 text-[15px] leading-7 text-[#181818]">
      {lines.map((line, i) => {
        if (!line) return <div key={i} className="h-2" />;
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return (
          <p key={i}>
            {parts.map((part, j) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return (
                  <strong key={j} className="font-semibold text-[#181818]">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              if (part.startsWith("`") && part.endsWith("`")) {
                return (
                  <code key={j} className="rounded bg-[#f2f2f2] px-1.5 py-0.5 font-mono text-[13px] text-[#181818]">
                    {part.slice(1, -1)}
                  </code>
                );
              }
              return <span key={j}>{part}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}
