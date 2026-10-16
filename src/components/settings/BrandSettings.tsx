// Settings → Appearance → Brand (P-AIFIRST): the white-label app name and
// logo. Admin-scope: never part of a workspace profile.
import * as React from "react";
import { Button, InlineNotification, Input } from "@nicecxone/lyra-ui";
import { DEFAULT_APP_NAME, LOGO_ERROR_MESSAGES, readLogoFile, useBrand, useSettings } from "@/settings";

export function BrandSettings() {
  const [appearance, updateAppearance] = useSettings("appearance");
  const { brand } = appearance;
  const { logoSrc, customLogo } = useBrand();
  const [logoError, setLogoError] = React.useState<string | null>(null);
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
    </div>
  );
}
