import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, X, RefreshCw, CheckCircle2 } from "lucide-react";
import { formatBytes } from "@/lib/matchwheels";
import { cn } from "@/lib/utils";

interface UploadCardProps {
  step: number;
  label: string;
  helper: string;
  file: File | null;
  onFile: (file: File | null) => void;
  disabled?: boolean;
  accent?: "violet" | "teal";
}

export function UploadCard({
  step,
  label,
  helper,
  file,
  onFile,
  disabled,
  accent = "violet",
}: UploadCardProps) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    const f = files[0];
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      // Let parent surface this; for now just reject by not setting
      onFile(null);
      alert("Please select an Excel file (.xlsx or .xls).");
      return;
    }
    onFile(f);
  };

  const accentRing =
    accent === "violet"
      ? "ring-[oklch(0.59_0.22_280/0.35)]"
      : "ring-[oklch(0.72_0.14_180/0.4)]";
  const accentBadge =
    accent === "violet"
      ? "bg-[oklch(0.59_0.22_280/0.12)] text-[oklch(0.45_0.2_280)]"
      : "bg-[oklch(0.72_0.14_180/0.15)] text-[oklch(0.4_0.13_180)]";

  return (
    <div
      className={cn(
        "glass rounded-2xl border border-border p-5 sm:p-6 transition-all",
        "hover:shadow-lift",
        drag && `ring-4 ${accentRing}`,
        disabled && "opacity-60 pointer-events-none"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold",
              accentBadge
            )}
          >
            {step}
          </span>
          <h3 className="font-semibold text-foreground">{label}</h3>
        </div>
        {file && (
          <CheckCircle2
            className="h-5 w-5 text-[oklch(0.72_0.14_180)]"
            aria-label="File ready"
          />
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-4">{helper}</p>

      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "w-full min-h-[140px] rounded-xl border-2 border-dashed border-border",
            "flex flex-col items-center justify-center gap-2 px-4 py-6",
            "bg-white/50 hover:bg-white/80 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          )}
        >
          <span
            className={cn(
              "rounded-full p-3",
              accent === "violet"
                ? "bg-[oklch(0.59_0.22_280/0.12)]"
                : "bg-[oklch(0.72_0.14_180/0.15)]"
            )}
          >
            <Upload
              className={cn(
                "h-5 w-5",
                accent === "violet"
                  ? "text-[oklch(0.45_0.2_280)]"
                  : "text-[oklch(0.4_0.13_180)]"
              )}
            />
          </span>
          <span className="text-sm font-medium text-foreground">
            Drop file here or click to select
          </span>
          <span className="text-xs text-muted-foreground">.xlsx or .xls</span>
        </button>
      ) : (
        <div className="rounded-xl border border-border bg-white/70 p-4 flex items-center gap-3">
          <div
            className={cn(
              "rounded-lg p-2.5",
              accent === "violet"
                ? "bg-[oklch(0.59_0.22_280/0.12)]"
                : "bg-[oklch(0.72_0.14_180/0.15)]"
            )}
          >
            <FileSpreadsheet
              className={cn(
                "h-5 w-5",
                accent === "violet"
                  ? "text-[oklch(0.45_0.2_280)]"
                  : "text-[oklch(0.4_0.13_180)]"
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">
              {file.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatBytes(file.size)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-border bg-white hover:bg-accent px-2 text-xs font-medium text-foreground"
            aria-label="Replace file"
            title="Replace file"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onFile(null)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-white hover:bg-destructive/10 hover:text-destructive text-foreground"
            aria-label="Remove file"
            title="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
    </div>
  );
}
