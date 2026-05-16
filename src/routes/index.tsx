import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  Play,
  RotateCcw,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { UploadCard } from "@/components/UploadCard";
import { MatchWheelsTitle } from "@/components/MatchWheelsLogo";
import { CarLoader } from "@/components/CarLoader";
import {
  downloadEnriched,
  readWorkbookFromFile,
  runMatching,
  validateWorkbook,
  type MatchSummary,
  type ParsedWorkbook,
  type ValidationError,
} from "@/lib/matchwheels";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MatchWheels — Pricer to Matrix MSRP Updater" },
      {
        name: "description",
        content:
          "Upload a PRICER and a Matrix Excel file. MatchWheels matches each car version, scores confidence, and fills MSRP automatically.",
      },
      { property: "og:title", content: "MatchWheels — Matrix MSRP Updater" },
      {
        property: "og:description",
        content:
          "Automated, deterministic car version matching from PRICER catalogues into Matrix samples.",
      },
    ],
  }),
  component: Index,
});

type Phase = "idle" | "processing" | "done" | "error";

function Index() {
  const [pricerFile, setPricerFile] = useState<File | null>(null);
  const [matrixFile, setMatrixFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<MatchSummary | null>(null);
  const [matrixWb, setMatrixWb] = useState<ParsedWorkbook | null>(null);

  const ready = !!pricerFile && !!matrixFile;
  const processing = phase === "processing";

  const buttonLabel = useMemo(() => {
    if (processing) return "Matching versions...";
    if (!ready) return "Upload both files to continue";
    return "Run matching process";
  }, [ready, processing]);

  const reset = () => {
    setPricerFile(null);
    setMatrixFile(null);
    setPhase("idle");
    setErrors([]);
    setErrorMessage(null);
    setSummary(null);
    setMatrixWb(null);
  };

  const handleRun = async () => {
    if (!pricerFile || !matrixFile) {
      setErrorMessage("Please upload both Excel files before running the process.");
      setPhase("error");
      return;
    }
    setPhase("processing");
    setErrors([]);
    setErrorMessage(null);
    setSummary(null);
    setMatrixWb(null);

    try {
      // Let UI paint the loader before heavy work
      await new Promise((r) => setTimeout(r, 30));

      const [pricer, matrix] = await Promise.all([
        readWorkbookFromFile(pricerFile, "pricer"),
        readWorkbookFromFile(matrixFile, "matrix"),
      ]);

      const allErrors = [
        ...validateWorkbook(pricer),
        ...validateWorkbook(matrix),
      ];
      if (allErrors.length) {
        setErrors(allErrors);
        setPhase("error");
        return;
      }

      const result = runMatching(pricer, matrix);
      setSummary(result);
      setMatrixWb(matrix);
      setPhase("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown processing error.";
      setErrorMessage(msg);
      setPhase("error");
    }
  };

  return (
    <main className="min-h-screen px-4 sm:px-6 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-[1040px]">
        {/* Header */}
        <header className="mb-10 sm:mb-12">
          <MatchWheelsTitle />
          <p className="mt-5 text-base text-muted-foreground max-w-2xl leading-relaxed">
            Upload a full <span className="text-foreground font-medium">PRICER</span>{" "}
            (“Pricer en formato matriz”) and a{" "}
            <span className="text-foreground font-medium">Matrix</span> sample file.
            The app matches each Matrix car version against the PRICER, scores
            confidence, and fills the matched List Price automatically.
          </p>
          <p className="mt-3 text-sm text-muted-foreground/90 max-w-2xl">
            Output: confidence in column{" "}
            <code className="rounded bg-accent px-1.5 py-0.5 text-foreground">DF</code>
            , matched List_Price in column{" "}
            <code className="rounded bg-accent px-1.5 py-0.5 text-foreground">DG</code>
            . Make sure they are empty in your Matrix before uploading — and that
            nothing was touched in the original PRICER file.
          </p>
        </header>

        {/* Upload cards */}
        <section className="grid gap-5 md:grid-cols-2">
          <UploadCard
            step={1}
            label="Upload PRICER file"
            helper="Full catalogue with all versions and List_Price in column AF. Usually named Fichero_PRICER_en_formato_MATRIZ…"
            file={pricerFile}
            onFile={setPricerFile}
            disabled={processing}
            accent="violet"
          />
          <UploadCard
            step={2}
            label="Upload Matrix file"
            helper="Sample file to enrich. Confidence will be written to DF and matched price to DG. Usually named Matrix…"
            file={matrixFile}
            onFile={setMatrixFile}
            disabled={processing}
            accent="teal"
          />
        </section>

        {/* Run button */}
        <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-[oklch(0.72_0.14_180)]" />
            Files are processed locally in your browser. Nothing is uploaded.
          </div>
          <button
            type="button"
            onClick={handleRun}
            disabled={!ready || processing}
            className={cn(
              "inline-flex items-center justify-center gap-2 h-12 min-w-[260px] rounded-xl px-6 text-sm font-semibold",
              "bg-gradient-to-r from-[oklch(0.59_0.22_280)] to-[oklch(0.55_0.22_310)]",
              "text-primary-foreground shadow-lift",
              "transition-all hover:translate-y-[-1px] hover:shadow-[0_14px_44px_-10px_rgba(109,93,251,0.45)]",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
          >
            <Play className="h-4 w-4" />
            {buttonLabel}
          </button>
        </div>

        {/* Status area */}
        <section className="mt-8">
          {phase === "processing" && (
            <div className="glass rounded-2xl border border-border p-6">
              <CarLoader message="Reading files, validating columns, and matching car versions…" />
            </div>
          )}

          {phase === "error" && (
            <div
              role="alert"
              className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    {errors.length
                      ? "Validation failed"
                      : errorMessage
                      ? "Something went wrong"
                      : "Please check your files"}
                  </h3>
                  {errorMessage && (
                    <p className="mt-1 text-sm text-foreground/80">{errorMessage}</p>
                  )}
                  {!!errors.length && (
                    <ul className="mt-3 space-y-2 text-sm">
                      {errors.map((e, i) => (
                        <li
                          key={i}
                          className="rounded-lg border border-destructive/20 bg-white/70 p-3"
                        >
                          <span className="font-medium text-foreground">
                            {e.file}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            · column {e.column}
                          </span>
                          <div className="mt-1 text-foreground/80">{e.message}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Expected:{" "}
                            <code className="rounded bg-accent px-1 py-0.5">
                              {e.expected}
                            </code>{" "}
                            · Found:{" "}
                            <code className="rounded bg-accent px-1 py-0.5">
                              {e.found}
                            </code>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    Replace one or both files and run the process again.
                  </p>
                </div>
              </div>
            </div>
          )}

          {phase === "done" && summary && matrixWb && (
            <ResultPanel
              summary={summary}
              onDownload={() => downloadEnriched(matrixWb, summary)}
              onReset={reset}
            />
          )}
        </section>

        <footer className="mt-16 text-center text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Upload a PRICER ("Pricer in matrix format") and a Matrix file. The app
          matches each Matrix car version against the PRICER, scores confidence,
          and fills the matched MSRP automatically.
        </footer>
      </div>
    </main>
  );
}

function ResultPanel({
  summary,
  onDownload,
  onReset,
}: {
  summary: MatchSummary;
  onDownload: () => void;
  onReset: () => void;
}) {
  const stats = [
    { label: "Rows processed", value: summary.total, tone: "neutral" as const },
    { label: "High confidence", value: summary.high, tone: "success" as const, hint: "≥ 90" },
    { label: "Medium confidence", value: summary.medium, tone: "violet" as const, hint: "75–89" },
    { label: "Low confidence", value: summary.low, tone: "amber" as const, hint: "50–74" },
    { label: "No reliable match", value: summary.none, tone: "muted" as const, hint: "< 50" },
  ];
  const successMessage = `Processing completed with ${summary.high} high-confidence, ${summary.medium} medium-confidence, and ${
    summary.low + summary.none
  } low/no matches.`;

  return (
    <div className="glass rounded-2xl border border-border p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-[oklch(0.72_0.14_180/0.15)] p-2">
          <Sparkles className="h-5 w-5 text-[oklch(0.4_0.13_180)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Matching complete
          </h2>
          <p className="text-sm text-muted-foreground">{successMessage}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="mt-7 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-border bg-white px-5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Start again
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center justify-center gap-2 h-11 rounded-xl px-6 text-sm font-semibold bg-foreground text-background hover:opacity-90 transition-opacity shadow-soft"
        >
          <Download className="h-4 w-4" />
          Download enriched Matrix
        </button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: "neutral" | "success" | "violet" | "amber" | "muted";
  hint?: string;
}) {
  const toneClasses: Record<typeof tone, string> = {
    neutral: "from-white to-white",
    success:
      "from-[oklch(0.72_0.14_180/0.15)] to-[oklch(0.72_0.14_180/0.04)] text-[oklch(0.35_0.13_180)]",
    violet:
      "from-[oklch(0.59_0.22_280/0.14)] to-[oklch(0.59_0.22_280/0.03)] text-[oklch(0.4_0.2_280)]",
    amber:
      "from-[oklch(0.85_0.15_85/0.25)] to-[oklch(0.85_0.15_85/0.05)] text-[oklch(0.45_0.13_80)]",
    muted: "from-accent to-white text-muted-foreground",
  };
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-gradient-to-br p-4",
        toneClasses[tone]
      )}
    >
      <div className="text-2xl font-semibold text-foreground tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-xs font-medium">
        {label}
        {hint && (
          <span className="ml-1 text-muted-foreground/80 font-normal">
            · {hint}
          </span>
        )}
      </div>
    </div>
  );
}
