# 0001. Adopt a shadcn preset as the base UI config

## Status

Accepted

## Context

The repo was scaffolded with `shadcn/ui` on the `base-nova` style, using
`@base-ui/react` as the underlying component library (not Radix). Before
starting any real screen work, we wanted the base tokens (colors, radius,
fonts) and component variants to reflect an intentional design direction
rather than the scaffold defaults.

Using ui.shadcn.com's theme customizer, a preset (`b3e3Rtow7k`) was saved
that captures the desired base tokens. Applying it via
`shadcn init --preset b3e3Rtow7k` overwrites `components.json`, the
CSS theme variables in `src/app/globals.css`, and re-generates any
already-installed `src/components/ui/*` components against the new tokens.

## Decision

- Adopt preset `b3e3Rtow7k` as the project's base UI config, applied via
  `bunx --bun shadcn@latest init --preset b3e3Rtow7k`.
- Keep `@base-ui/react` as the component library — the preset only changes
  the style (`base-nova` → `base-maia`) and tokens (color palette, radius,
  fonts), not the underlying library.
- Re-generate all already-installed components (`button`, `card`, `input`,
  `label`) with `--overwrite`/`--reinstall` so no component is left
  referencing stale tokens.
- Any future preset change goes through this same review: run `init`,
  diff `components.json` / `globals.css` / component files, confirm no
  unintended library swap, then commit.

## Consequences

- All new screens built from this point use the `base-maia` tokens
  (amber/gold primary, `--radius: 0.875rem`, `Inter` + `Geist` fonts) by
  default.
- Re-running `shadcn init --preset <id>` in the future will again overwrite
  these files; the diff-review step above should be repeated before
  committing.
