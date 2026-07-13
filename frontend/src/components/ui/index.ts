// DESIGN-SYSTEM §5 component inventory. Every user input is one of these; pages
// compose them and never style primitives (§6).

// §5.1 Inputs
export { MoneyInput } from "./MoneyInput";
export type { MoneyInputProps } from "./MoneyInput";
export { QuantityInput } from "./QuantityInput";
export type { QuantityInputProps } from "./QuantityInput";
export { PercentInput } from "./PercentInput";
export type { PercentInputProps } from "./PercentInput";
export { DateInput } from "./DateInput";
export type { DateInputProps } from "./DateInput";
export { TextInput } from "./TextInput";
export type { TextInputProps } from "./TextInput";
export { InstrumentPicker } from "./InstrumentPicker";
export type { InstrumentPickerProps, InstrumentPick } from "./InstrumentPicker";
export { MasterSelect } from "./MasterSelect";
export type { MasterSelectProps } from "./MasterSelect";
export { Select } from "./Select";
export type { SelectProps, SelectOption } from "./Select";
export { RowMenu } from "./RowMenu";
export type { RowMenuProps, RowMenuItem } from "./RowMenu";

// §5.2 Data display
export { DataTable } from "./DataTable";
export type { DataTableProps, Column, ColumnFormat, SortState } from "./DataTable";
export { TrendStat } from "./TrendStat";
export type { TrendStatProps } from "./TrendStat";
export { MetaStrip } from "./MetaStrip";
export type { MetaStripProps, MetaItem } from "./MetaStrip";
export { Sparkline } from "./Sparkline";
export type { SparklineProps } from "./Sparkline";
export { AllocationDonut } from "./AllocationDonut";
export type { AllocationDonutProps } from "./AllocationDonut";
export { PriceChart } from "./PriceChart";
export type { PriceChartProps, Overlay } from "./PriceChart";
export { Treemap } from "./Treemap";
export type { TreemapProps } from "./Treemap";
export type { TreemapNode } from "../../mocks/types";
export { QuoteCardRow } from "./QuoteCardRow";
export type { QuoteCardRowProps, QuoteSource } from "./QuoteCardRow";
export { NewsList } from "./NewsList";
export type { NewsListProps, NewsListItem } from "./NewsList";
export { Segmented } from "./Segmented";
export type { SegmentedProps, SegmentedOption } from "./Segmented";
export { TickerStrip } from "./TickerStrip";
export type { TickerStripProps } from "./TickerStrip";

// §5.3 Provenance & status
export { ProvenanceBadge } from "./ProvenanceBadge";
export type { ProvenanceBadgeProps } from "./ProvenanceBadge";
export { StalenessChip } from "./StalenessChip";
export type { StalenessChipProps } from "./StalenessChip";

// §5.4 Structure & chrome
export { PageHeader } from "./PageHeader";
export type { PageHeaderProps } from "./PageHeader";
export { EmptyState } from "./EmptyState";
export type { EmptyStateProps } from "./EmptyState";
export { ReviewCard } from "./ReviewCard";
export type { ReviewCardProps, ReviewSection, Verdict } from "./ReviewCard";
export { GlossaryTerm } from "./GlossaryTerm";
export type { GlossaryTermProps } from "./GlossaryTerm";

// §5.5 Global chrome (D-066) — PROPOSED 2026-07-11 (page-chrome Phase 0a).
// Ratify at the kitchen-sink look before shell assembly (C-1).
export { Sidebar } from "./Sidebar";
export type { SidebarProps } from "./Sidebar";
export { NAV_GROUPS } from "./nav";
export type { NavGroup, NavItem } from "./nav";
export { TopBar } from "./TopBar";
export type { TopBarProps } from "./TopBar";
export { StaleBanner } from "./StaleBanner";
export type { StaleBannerProps } from "./StaleBanner";
export { UpdateBanner } from "./UpdateBanner";
export type { UpdateBannerProps } from "./UpdateBanner";
export { DemoBadge } from "./DemoBadge";
export type { DemoBadgeProps } from "./DemoBadge";
export { Clock } from "./Clock";
export type { ClockProps } from "./Clock";
export { LockScreen } from "./LockScreen";
export type { LockScreenProps } from "./LockScreen";

// First-run checklist (D-045) — PROPOSED 2026-07-11 (page-first-run-checklist Phase 0a),
// ratify at /kitchen-sink before shell assembly.
export { Switch } from "./Switch";
export type { SwitchProps } from "./Switch";
export { Skeleton } from "./Skeleton";
export type { SkeletonProps } from "./Skeleton";
export { Combobox } from "./Combobox";
export type { ComboboxProps, ComboboxOption } from "./Combobox";
export { FirstRunChecklist } from "./FirstRunChecklist";
export type { FirstRunChecklistProps, FirstRunStepId, FirstRunLinks } from "./FirstRunChecklist";

// §5.4 / §5.5 amendments (2026-07-10 — Holdings page-build). Ratified at the
// kitchen-sink look (2026-07-10).
export { Dialog } from "./Dialog";
export type { DialogProps } from "./Dialog";
export { ConfirmDialog } from "./ConfirmDialog";
export type { ConfirmDialogProps } from "./ConfirmDialog";
export { FileInput } from "./FileInput";
export type { FileInputProps } from "./FileInput";
export { ToastProvider } from "./ToastProvider";
export { useToast } from "./toast-context";
export type { ToastSpec, ToastAction, ToastState } from "./toast-context";
