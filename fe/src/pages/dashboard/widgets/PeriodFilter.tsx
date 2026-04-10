export type Period = "today" | "this_week" | "this_month" | "this_year";

export const periodLabels: Record<Period, string> = {
  today: "Today",
  this_week: "This Week",
  this_month: "This Month",
  this_year: "This Year",
};

export function PeriodFilter({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {(Object.keys(periodLabels) as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === p
              ? "bg-primary-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          }`}
        >
          {periodLabels[p]}
        </button>
      ))}
    </div>
  );
}
