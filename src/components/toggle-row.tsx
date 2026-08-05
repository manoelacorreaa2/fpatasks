import { Button } from "@/components/ui/button";

export interface ToggleOption<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

export function ToggleRow<T extends string | number>({
  options,
  value,
  onChange,
  allowClear = true,
}: {
  options: ToggleOption<T>[];
  value: T | null | undefined;
  onChange: (v: T | null) => void;
  allowClear?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Button
            key={String(o.value)}
            type="button"
            size="sm"
            variant={active ? "default" : "outline"}
            className="h-8 min-w-9 px-2.5"
            onClick={() => onChange(active && allowClear ? null : o.value)}
            title={o.hint}
          >
            {o.label}
          </Button>
        );
      })}
    </div>
  );
}
