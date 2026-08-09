/**
 * The Phase D1 exemplar procedures, decided by the physician owner on 2026-08-08
 * (decision D-05). The D1 procedure routes serve exactly these three codes; every other
 * procedure code 404s on the new routes. This is a route-scope decision, not a claim that
 * other procedures do not exist — the index page says so explicitly.
 */
export const D1_EXEMPLAR_PROCEDURE_CODES = [
  'EBUS_TBNA',
  'THERAPEUTIC_BRONCH',
  'CHEST_TUBE',
] as const

export type D1ExemplarProcedureCode = (typeof D1_EXEMPLAR_PROCEDURE_CODES)[number]

const EXEMPLAR_SET: ReadonlySet<string> = new Set(D1_EXEMPLAR_PROCEDURE_CODES)

export function isExemplarProcedureCode(code: string): code is D1ExemplarProcedureCode {
  return EXEMPLAR_SET.has(code)
}
