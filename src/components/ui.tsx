import type { ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" | "danger" };

export const buttonClass = (variant: ButtonProps["variant"] = "secondary", extra?: string) =>
  cx(
    "pressable inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium select-none",
    "disabled:pointer-events-none disabled:opacity-50",
    variant === "primary" && "bg-primary text-on-primary hover:opacity-90",
    variant === "secondary" && "border border-line-strong bg-surface text-ink hover:bg-surface-2",
    variant === "ghost" && "text-ink-2 hover:bg-surface-2 hover:text-ink",
    variant === "danger" && "border border-line-strong bg-surface text-danger hover:bg-danger-bg",
    extra,
  );

export function Button({ variant, className, ...props }: ButtonProps) {
  return <button {...props} className={buttonClass(variant, className)} />;
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const inputClass = cx(
  "h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink",
  "placeholder:text-ink-3 hover:border-ink-3 focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/25",
);

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(inputClass, "h-auto min-h-24 py-2 leading-relaxed", props.className)} />;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
