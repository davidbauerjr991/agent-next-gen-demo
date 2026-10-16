// Settings → Appearance → Brand (P-AIFIRST): the white-label app name, logo
// and brand colors. Admin-scope: never part of a workspace profile.
import * as React from "react";
import { Button, InlineNotification, Input } from "@nicecxone/lyra-ui";
import {
  DEFAULT_APP_NAME,
  LOGO_ERROR_MESSAGES,
  primaryContrastFailures,
  readLogoFile,
  useBrand,
  useSettings,
} from "@/settings";

export function BrandSettings() {
  const [appearance, updateAppearance] = useSettings("appearance");
  const { brand } = appearance;
  const { logoSrc, customLogo } = useBrand();
  const [logoError, setLogoError] = React.useState<string | null>(null);
  const primaryFailures = brand.colors.primary ? primaryContrastFailures(brand.colors.primary) : [];
  const fileInput = React.useRef<HTMLInputElement>(null);
  const updateBrand = (patch: Partial<typeof brand>) => updateAppearance((prev) => ({ brand: { ...prev.brand, ...patch } }));

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // the same file can be picked again
    if (!file) return;
    const result = await readLogoFile(file);
    if (!result.ok) {
      setLogoError(LOGO_ERROR_MESSAGES[result.reason]);
      return;
    }
    setLogoError(null);
    updateBrand({ logo: result.dataUrl });
  };

  return (
    <div className="flex flex-col gap-4" data-setting="brand">
      <div className="max-w-xs">
        <Input
          label="App name"
          value={brand.appName}
          placeholder={DEFAULT_APP_NAME}
          onChange={(e) => updateBrand({ appName: e.target.value })}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="lyra-label text-lyra-fg-default">Logo</span>
        <div className="flex items-center gap-3">
          <img src={logoSrc} alt="Current logo" className="h-10 w-10 object-contain" data-slot="logo-preview" />
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            Upload logo
          </Button>
          {customLogo && (
            <Button
              variant="ghost"
              onClick={() => {
                setLogoError(null);
                updateBrand({ logo: null });
              }}
            >
              Remove
            </Button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/svg+xml,image/jpeg"
            className="sr-only"
            tabIndex={-1}
            aria-label="Logo file"
            data-slot="logo-input"
            onChange={onFile}
          />
        </div>
        <p className="lyra-body-sm text-lyra-fg-secondary">PNG, SVG or JPEG, up to 256 KB. Shown in the header, launch screen and welcome.</p>
        {logoError && <InlineNotification variant="error">{logoError}</InlineNotification>}
      </div>
      <div className="flex flex-col gap-3" data-setting="brand-colors">
        <span className="lyra-label text-lyra-fg-default">Brand colors</span>
        <ColorRow
          label="Primary"
          value={brand.colors.primary}
          fallback={LYRA_PRIMARY}
          onChange={(primary) => updateBrand({ colors: { ...brand.colors, primary } })}
        />
        {primaryFailures.length > 0 && (
          <InlineNotification variant="warning">
            {`This primary doesn't meet WCAG AA contrast against the page background in ${primaryFailures.join(" and ")} mode.`}
          </InlineNotification>
        )}
        <ColorRow
          label="Accent"
          value={brand.colors.accent}
          fallback={LYRA_ACCENT}
          onChange={(accent) => updateBrand({ colors: { ...brand.colors, accent } })}
        />
        <p className="lyra-body-sm text-lyra-fg-secondary">
          Hover, pressed, subtle and text shades are derived for light and dark mode; text on the color is picked for contrast.
        </p>
        {(brand.colors.primary || brand.colors.accent) && (
          <div>
            <Button variant="ghost" onClick={() => updateBrand({ colors: { primary: null, accent: null } })}>
              Reset colors
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** lyra's own primary and AI accent: what an unset color shows. */
const LYRA_PRIMARY = "#166cca";
const LYRA_ACCENT = "#6149c1";

/** A swatch (the native color input) and a hex field; the hex applies on a
 *  valid value or on blur. lyra has no color picker. */
function ColorRow({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string | null;
  fallback: string;
  onChange: (value: string | null) => void;
}) {
  const shown = value ?? fallback;
  const [draft, setDraft] = React.useState(shown);
  React.useEffect(() => setDraft(shown), [shown]);
  const valid = (text: string) => /^#[0-9a-f]{6}$/i.test(text);
  return (
    <div className="flex items-end gap-3" data-color={label.toLowerCase()}>
      <input
        type="color"
        aria-label={`${label} color`}
        value={shown}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
        className="h-9 w-9 shrink-0 cursor-pointer rounded-lyra-sm border border-lyra-border-medium bg-transparent p-0.5"
      />
      <div className="w-36">
        <Input
          label={`${label} (hex)`}
          value={draft}
          error={draft !== shown && !valid(draft) ? "Use #RRGGBB" : undefined}
          onChange={(e) => {
            const text = e.target.value.trim();
            setDraft(text);
            if (valid(text)) onChange(text.toLowerCase());
          }}
          onBlur={() => !valid(draft) && setDraft(shown)}
        />
      </div>
    </div>
  );
}
