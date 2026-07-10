import type { ReactNode } from "react";
import "./data.css";
import "./structure.css";
import {
  formatMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatSignedMoney,
  formatSignedPercent,
  signOf,
} from "../../format/number";
import type { DecimalString } from "../../format/number";

// ONE implementation for every table (DESIGN-SYSTEM §5.2): Holdings, transactions,
// tax lots, drift, policy, insurance, estate, pricing health, accounts. Sticky
// header; aria-sort on sortable headers; numbers right-aligned + tabular +
// per-unit dp; export is server-side (P-5) — the client never generates the file.
// Respects density (§2.5).

export type ColumnFormat =
  | "text"
  | "money"
  | "price"
  | "percent"
  | "quantity"
  | "signed-money"
  | "signed-percent";

export interface Column<R> {
  key: keyof R & string;
  label: string;
  align?: "left" | "right";
  format?: ColumnFormat;
  sortable?: boolean;
  /** Truncate long text with an ellipsis (max-width) so it never forces the
   *  table wider than the viewport — graceful degradation at laptop widths. */
  truncate?: boolean;
  /** Custom cell renderer; overrides format. */
  render?: (row: R) => ReactNode;
}

export interface SortState {
  key: string;
  dir: "asc" | "desc";
}

export interface DataTableProps<R> {
  columns: Column<R>[];
  rows: R[];
  sort?: SortState;
  onSort?: (key: string) => void;
  filter?: { value: string; onChange: (v: string) => void; placeholder?: string };
  /** Server-side export trigger (P-5); the client never builds the file. */
  onExport?: () => void;
  stickyHeader?: boolean;
  density?: "comfortable" | "compact";
  rowLink?: (row: R) => string;
  caption?: string;
}

const NUMERIC: ColumnFormat[] = [
  "money", "price", "percent", "quantity", "signed-money", "signed-percent",
];

function renderCell<R>(col: Column<R>, row: R): ReactNode {
  if (col.render) return col.render(row);
  const raw = row[col.key] as DecimalString;
  switch (col.format) {
    case "money": return formatMoney(raw);
    case "price": return formatPrice(raw);
    case "percent": return formatPercent(raw);
    case "quantity": return formatQuantity(raw);
    case "signed-money": return formatSignedMoney(raw);
    case "signed-percent": return formatSignedPercent(raw);
    default: return (raw as ReactNode) ?? "—";
  }
}

export function DataTable<R>({
  columns,
  rows,
  sort,
  onSort,
  filter,
  onExport,
  stickyHeader = true,
  density,
  rowLink,
  caption,
}: DataTableProps<R>) {
  return (
    <div
      className="lf-table-wrap"
      {...(density ? { "data-density": density } : {})}
    >
      {(filter || onExport) && (
        <div className="lf-table__toolbar">
          {filter ? (
            <span className="lf-field lf-table__filter">
              <input
                className="lf-field__input"
                type="search"
                value={filter.value}
                placeholder={filter.placeholder ?? "Filter…"}
                aria-label="Filter table"
                onChange={(e) => filter.onChange(e.target.value)}
              />
            </span>
          ) : (
            <span />
          )}
          {onExport && (
            <button type="button" className="lf-btn" onClick={onExport}>
              Export (server-side)
            </button>
          )}
        </div>
      )}

      <table className="lf-table">
        {caption && <caption className="lf-empty__reason">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => {
              const isNum =
                col.align === "right" ||
                (col.format && NUMERIC.includes(col.format));
              const active = sort?.key === col.key;
              const ariaSort = !col.sortable
                ? undefined
                : active
                  ? sort?.dir === "asc"
                    ? "ascending"
                    : "descending"
                  : "none";
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={[
                    "lf-table__th",
                    isNum ? "lf-table__th--num" : "",
                    col.sortable ? "lf-table__th--sortable" : "",
                    stickyHeader ? "" : "",
                  ].join(" ")}
                  onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                  onKeyDown={
                    col.sortable && onSort
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSort(col.key);
                          }
                        }
                      : undefined
                  }
                  tabIndex={col.sortable ? 0 : undefined}
                >
                  {col.label}
                  {col.sortable && (
                    <span className="lf-table__sortglyph" aria-hidden="true">
                      {active ? (sort?.dir === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const href = rowLink?.(row);
            return (
              <tr
                key={ri}
                className={`lf-table__tr${href ? " lf-table__tr--link" : ""}`}
                onClick={href ? () => (window.location.hash = href) : undefined}
              >
                {columns.map((col) => {
                  const isNum =
                    col.align === "right" ||
                    (col.format && NUMERIC.includes(col.format));
                  let toneClass = "";
                  if (
                    col.format === "signed-money" ||
                    col.format === "signed-percent"
                  ) {
                    const s = signOf(row[col.key] as DecimalString);
                    toneClass =
                      s === "up"
                        ? " lf-table__td--gain"
                        : s === "down"
                          ? " lf-table__td--loss"
                          : "";
                  }
                  const cell = renderCell(col, row);
                  return (
                    <td
                      key={col.key}
                      className={`lf-table__td${isNum ? " lf-table__td--num" : ""}${toneClass}${col.truncate ? " lf-table__td--trunc" : ""}`}
                      title={col.truncate && typeof cell === "string" ? cell : undefined}
                    >
                      {cell}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
