import { useBrand } from "@/settings";

/** The header's top-left brand (P-AIFIRST): the white-label logo and app
 *  name, not a button. Shown while the app-name menu has no items (the
 *  profile entries left it; profiles are picked in Settings). Same spacing
 *  and type as lyra's `AppName`, without its menu chevron. */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  const { appName, logoSrc } = useBrand();
  return (
    <div className="inline-flex items-center gap-4 p-2" data-slot="brand-mark">
      <img src={logoSrc} alt={appName} className="h-6 w-6 shrink-0 object-contain" />
      {!compact && <span className="lyra-body-lg-emphasis text-lyra-fg-default">{appName}</span>}
    </div>
  );
}
