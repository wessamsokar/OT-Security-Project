type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

export function SectionTitle({ eyebrow, title, subtitle }: Props) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <p className="mb-3 text-xs uppercase tracking-[0.22em] text-brand/85">{eyebrow}</p>
      <h2 className="text-balance text-3xl font-semibold text-white/90 md:text-4xl">{title}</h2>
      <p className="mt-4 text-sm leading-relaxed text-muted/90 md:text-base">{subtitle}</p>
    </div>
  );
}
