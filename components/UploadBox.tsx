"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  onFilesSelected: (files: File[]) => void;
  previewUrls?: string[];
}

export function UploadBox({ onFilesSelected, previewUrls }: Props) {
  const [isDragging, setDragging] = useState(false);
  const [message, setMessage] = useState<string>("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(
    (files?: FileList | File[] | null) => {
      if (!files) return;
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (!list.length) {
        setMessage("Please choose image files");
        return;
      }
      setMessage("");
      onFilesSelected(list);
    },
    [onFilesSelected]
  );

  const onDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const onPaste = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith("image/")) {
            const blob = await item.getType(type);
            const file = new File([blob], "pasted-image" + type.replace("image", ""), { type });
            handleFiles([file]);
            return;
          }
        }
      }
      setMessage("No image found in clipboard");
    } catch (err) {
      setMessage("Clipboard read not allowed");
    }
  };

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  return (
    <div className="space-y-3">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border px-6 py-8 text-center transition hover:border-accent ${
          isDragging ? "bg-panel/60" : "bg-panel/40"
        }`}
      >
        <div className="text-lg font-semibold">Upload or Drag TradingView screenshots</div>
        <div className="text-sm text-muted">Multi-chart drop/paste is supported for top-down analysis</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            className="rounded-lg bg-accent/10 px-4 py-2 text-sm font-medium text-accent hover:bg-accent/20"
            onClick={() => inputRef.current?.click()}
          >
            Choose file
          </button>
          <button
            type="button"
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:border-accent hover:text-accent"
            onClick={onPaste}
          >
            Paste from clipboard
          </button>
        </div>
        {message && <p className="text-sm text-rose-300">{message}</p>}
      </label>
      {previewUrls && previewUrls.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {previewUrls.map((url, idx) => (
            <div key={idx} className="overflow-hidden rounded-xl border border-border bg-panel">
              <img src={url} alt={`Preview ${idx + 1}`} className="max-h-72 w-full object-contain" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
