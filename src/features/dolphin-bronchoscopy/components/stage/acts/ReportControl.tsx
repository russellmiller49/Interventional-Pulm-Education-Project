'use client'

import { useMemo, useState } from 'react'

import {
  allowedReached,
  DOLPHIN_REPORT_TEMPLATES,
  initialReportRow,
  reportRowErrors,
  type ReportRow,
  type ReportTemplateId,
} from '../../../content/reportForm'
import styles from '../dolphin-stage.module.css'

/**
 * The bronchoscopy record, pre-filled from the survey just driven. A site the scope never entered
 * can only be written "not reached"; the record is complete when no row claims what the survey
 * does not support. What is written stays on this page; nothing is stored.
 */
export function ReportControl({
  templateId,
  visited,
  done,
  onDone,
}: {
  readonly templateId: ReportTemplateId
  readonly visited: ReadonlySet<string>
  readonly done: boolean
  readonly onDone: () => void
}) {
  const template = DOLPHIN_REPORT_TEMPLATES[templateId]
  const [rows, setRows] = useState<Record<string, ReportRow>>({})
  const [balReturned, setBalReturned] = useState<string[]>(() =>
    Array(template.balReturnEntries).fill(''),
  )
  const [attempted, setAttempted] = useState(false)
  const rowFor = (siteId: string) => {
    const site = template.sites.find((s) => s.id === siteId)!
    return rows[siteId] ?? initialReportRow(site, visited)
  }
  const errors = useMemo(
    () => template.sites.flatMap((site) => reportRowErrors(site, rowFor(site.id), visited)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, visited, template],
  )
  const update = (siteId: string, patch: Partial<ReportRow>) =>
    setRows((current) => ({ ...current, [siteId]: { ...rowFor(siteId), ...patch } }))

  return (
    <section
      className={styles.question}
      aria-label="Bronchoscopy record"
      data-landmark="Bronchoscopy record"
      data-report={template.id}
    >
      <p className={styles.stem}>{template.title}</p>
      <p className={styles.rowFeedback}>{template.status}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Site</th>
              <th scope="col">Reached</th>
              <th scope="col">Appearance</th>
              <th scope="col">Secretions</th>
              <th scope="col">Sampled</th>
            </tr>
          </thead>
          <tbody>
            {template.sites.map((site) => {
              const row = rowFor(site.id)
              const notReached = row.reached === 'not-reached'
              return (
                <tr key={site.id} data-site={site.abbr} data-visited={visited.has(site.abbr)}>
                  <th scope="row">{site.label}</th>
                  <td>
                    <select
                      aria-label={`${site.label}: reached`}
                      value={row.reached}
                      disabled={done}
                      onChange={(event) => {
                        const reached = event.target.value as ReportRow['reached']
                        update(
                          site.id,
                          reached === 'not-reached'
                            ? {
                                reached,
                                appearance: 'not-seen',
                                secretions: 'not-seen',
                                sampled: 'none',
                              }
                            : { reached, appearance: 'normal', secretions: 'none' },
                        )
                      }}
                    >
                      <option
                        value="reached"
                        disabled={!allowedReached(site, visited).includes('reached')}
                      >
                        Reached
                      </option>
                      <option value="not-reached">Not reached</option>
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`${site.label}: appearance`}
                      value={row.appearance}
                      disabled={done || notReached}
                      onChange={(event) =>
                        update(site.id, {
                          appearance: event.target.value as ReportRow['appearance'],
                        })
                      }
                    >
                      <option value="normal">Normal</option>
                      <option value="abnormal">Abnormal</option>
                      <option value="not-seen">Not seen</option>
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`${site.label}: secretions`}
                      value={row.secretions}
                      disabled={done || notReached}
                      onChange={(event) =>
                        update(site.id, {
                          secretions: event.target.value as ReportRow['secretions'],
                        })
                      }
                    >
                      <option value="none">None</option>
                      <option value="some">Some</option>
                      <option value="copious">Copious</option>
                      <option value="not-seen">Not seen</option>
                    </select>
                  </td>
                  <td>
                    <select
                      aria-label={`${site.label}: sampled`}
                      value={row.sampled}
                      disabled={done || notReached}
                      onChange={(event) =>
                        update(site.id, { sampled: event.target.value as ReportRow['sampled'] })
                      }
                    >
                      <option value="none">None</option>
                      <option value="lavage">Lavage</option>
                      <option value="brush">Brush</option>
                      <option value="biopsy">Biopsy</option>
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <fieldset className={styles.choices}>
        <legend className={styles.rowFeedback}>
          {template.recordsInstilled
            ? 'Lavage: instilled and returned (mL)'
            : 'Lavage fluid volume returned (mL), as the form records it'}
        </legend>
        <div className={styles.actions}>
          {balReturned.map((value, index) => (
            <input
              key={index}
              inputMode="decimal"
              className="w-24 rounded-md border px-2 py-1 text-slate-950"
              aria-label={`Lavage return ${index + 1}, mL`}
              value={value}
              disabled={done}
              onChange={(event) =>
                setBalReturned((current) =>
                  current.map((v, i) => (i === index ? event.target.value : v)),
                )
              }
            />
          ))}
        </div>
      </fieldset>
      {attempted && errors.length > 0 ? (
        <ul className={styles.note} data-tone="hint" data-report-errors>
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {done ? (
        <p className={styles.note} data-tone="done" data-report-done>
          Recorded. Every site has a line, including the ones not reached.
        </p>
      ) : (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            data-primary="true"
            onClick={() => {
              setAttempted(true)
              if (errors.length === 0) onDone()
            }}
            data-write-record
          >
            Write the record
          </button>
        </div>
      )}
    </section>
  )
}
