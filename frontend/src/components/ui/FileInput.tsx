import { useRef, useState } from "react";
import "./inputs.css";
import "./FileInput.css";

// Token-styled file picker (DESIGN-SYSTEM §5.1, amended 2026-07-10 — Holdings
// page-build §9-3). Wraps the native input internally so §6's "no raw <input>"
// rule holds; supports click-to-browse and drag-and-drop. Used for CSV import.
export interface FileInputProps {
  onChange: (files: FileList) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  "aria-label": string;
  /** Button/prompt text. */
  label?: string;
}

export function FileInput({
  onChange,
  accept,
  multiple,
  disabled,
  "aria-label": ariaLabel,
  label = "Choose a file",
}: FileInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function take(files: FileList | null) {
    if (!files || files.length === 0) return;
    setName(
      files.length === 1 ? files[0].name : `${files.length} files selected`,
    );
    onChange(files);
  }

  return (
    <div
      className={`lf-file${dragging ? " lf-file--drag" : ""}${disabled ? " lf-file--disabled" : ""}`}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        className="lf-file__native"
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => take(e.target.files)}
      />
      <button
        type="button"
        className="lf-btn"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {label}
      </button>
      <span className="lf-file__name">
        {name ?? "or drag a file here"}
      </span>
    </div>
  );
}
