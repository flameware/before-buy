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
- ~~Any future preset change goes through this same review: run `init`,
  diff `components.json` / `globals.css` / component files, confirm no
  unintended library swap, then commit.~~ **Superseded by ADR-0014** — 본 트리에서
  `init`을 돌리는 것은 `ui/*`에 손으로 쓴 결정이 쌓인 뒤로 더 이상 안전하지 않다.

## Consequences

- All new screens built from this point use the `base-maia` tokens
  (amber/gold primary, `--radius: 0.875rem`, `Inter` + `Geist` fonts) by
  default. **색과 곡률은 그 뒤 바뀌었다** — `--radius`는 0.25rem(#145), primary는
  프리셋 `b7Br8OViy`의 라임(ADR-0014). `Inter` + `Geist` 폰트 구성은 그대로이며,
  `b7Br8OViy`가 제안한 `--font-heading` 통합은 의도적으로 받지 않았다.
- Re-running `shadcn init --preset <id>` in the future will again overwrite
  these files — ADR-0014가 그 실행을 격리 워크트리로 옮긴 이유다.
