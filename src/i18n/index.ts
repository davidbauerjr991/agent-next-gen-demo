// The string layer (CLAUDE.md: no user-visible string literal in a
// component). Until P-I18N this is the identity shim: English is the source
// locale and the key is the English text, with ICU's simple `{name}`
// arguments filled from `vars`. P-I18N replaces the body with ICU message
// lookup per the active locale; call sites don't change.
export const t = (key: string, vars?: Record<string, unknown>): string =>
  vars ? key.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : key;
