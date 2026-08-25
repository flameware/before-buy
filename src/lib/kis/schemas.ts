// Schemas for KIS API responses.
//
// KIS sends every number as a string ("27275", "+4.02", ...). parseFloat of a missing
// field is NaN, and NaN satisfies TypeScript's `number` — it would sail through and
// land in the app as a plausible-looking price. Ported from investmentdiary's
// src/lib/kis/schemas.ts (issue #5 research), trimmed to the 현재가 endpoint.

import { z } from "zod";

/** Strip the leading '+' KIS puts on positive rates; Number() will not accept it. */
const clean = (s: string) => s.trim().replace(/^\+/, "");

/** A required KIS numeric field — the current price and nothing else. */
const kisNumber = z
  .union([z.number(), z.string()], {
    error: "KIS 응답에 숫자 필드가 없거나 형식이 잘못되었습니다",
  })
  .refine((v) => typeof v === "number" || clean(v) !== "", "값이 비어 있습니다")
  .transform((v) => (typeof v === "number" ? v : Number(clean(v))))
  .refine(Number.isFinite, "숫자로 변환할 수 없습니다");

/** An optional KIS numeric field — volume, previous-day change and similar extras. */
const optionalKisNumber = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (typeof v === "number") return v;
    const trimmed = clean(v);
    return trimmed === "" ? undefined : Number(trimmed);
  })
  .refine((v) => v === undefined || Number.isFinite(v), "숫자로 변환할 수 없습니다");

const kisRate = optionalKisNumber;

/** The envelope every KIS endpoint wraps its payload in. */
export const KISEnvelopeSchema = z.looseObject({
  rt_cd: z.string(),
  msg_cd: z.string().optional().default(""),
  msg1: z.string().optional().default(""),
});

/**
 * `FHKST01010100` 국내주식 현재가 — the fields the client reads, no more.
 * Loose so the rest of the payload survives into metadata.originalData.
 */
export const KoreanPriceOutputSchema = z.looseObject({
  // 현재가. Asked about a ticker that does not exist, KIS answers rt_cd "0" — success
  // — with every numeric field set to 0, so a ₩0 quote is the only signal of that.
  stck_prpr: kisNumber.refine(
    (n) => n > 0,
    "국내 현재가가 0 이하입니다 (없는 종목일 수 있습니다)"
  ),
  stck_oprc: optionalKisNumber, // 시가
  stck_hgpr: optionalKisNumber, // 고가
  stck_lwpr: optionalKisNumber, // 저가
  acml_vol: optionalKisNumber, // 누적 거래량
  prdy_vrss: optionalKisNumber, // 전일 대비
  prdy_ctrt: kisRate, // 전일 대비율
  // PER/PBR은 재무비율(FHKST66430300)이 아니라 이 현재가 응답 자체에 실려 온다 —
  // issue #13에서 실전 키로 실 호출해 확인(docs/research/kis-financial-ratio.md).
  per: optionalKisNumber,
  pbr: optionalKisNumber,
});
export type KoreanPriceOutput = z.infer<typeof KoreanPriceOutputSchema>;

/**
 * `FHKST66430300` 국내주식 재무비율 — PER/PBR은 여기 없다(위 참고). 실제 확인된
 * 필드(stac_yymm/grs/bsop_prfi_inrt/ntin_inrt/roe_val/eps/sps/bps/rsrv_rate/
 * lblt_rate)는 `docs/research/kis-financial-ratio.md` 참고. `looseObject`라
 * 미확정 필드도 `metadata.originalData`로 보존된다.
 */
export const FinancialRatioOutputSchema = z.looseObject({});

/** Flatten Zod issues into one line suitable for error messages. */
export function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}
