import { useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { DEFAULT_USER_ID, supabase } from '../lib/supabase'
import { color, font, label, radius, stageLabel } from '../lib/tokens'
import type { ContactType, SignalKind, Stage } from '../lib/types'

const contactTypes: ContactType[] = ['client', 'partner', 'channel', 'peer', 'unknown']
const stages: Stage[] = ['silent', 'warming', 'contacted', 'conversation', 'dormant']

interface ManualForm {
  name: string
  linkedin_url: string
  role_title: string
  company: string
  contact_type: ContactType
  stage: Stage
}

const emptyManualForm: ManualForm = {
  name: '',
  linkedin_url: '',
  role_title: '',
  company: '',
  contact_type: 'unknown',
  stage: 'silent',
}

type ImportField = 'name' | 'linkedin_url' | 'role_title' | 'company' | 'engagement_type' | 'date'

type ColumnMapping = Partial<Record<ImportField, string>>

interface RowError {
  row: number
  message: string
}

interface ImportResult {
  contactsUpserted: number
  signalsInserted: number
  errors: RowError[]
}

const importFields: { field: ImportField; label: string; required: boolean }[] = [
  { field: 'name', label: 'Name', required: true },
  { field: 'linkedin_url', label: 'LinkedIn URL', required: true },
  { field: 'role_title', label: 'Role title', required: false },
  { field: 'company', label: 'Company', required: false },
  { field: 'engagement_type', label: 'Engagement type', required: false },
  { field: 'date', label: 'Date', required: false },
]

const fieldCandidates: Record<ImportField, string[]> = {
  name: ['name', 'fullname', 'contactname', 'person'],
  linkedin_url: ['linkedinurl', 'profileurl', 'linkedin', 'profilelink', 'url', 'link'],
  role_title: ['title', 'role', 'position', 'jobtitle', 'headline'],
  company: ['company', 'organization', 'organisation', 'employer'],
  engagement_type: ['engagementtype', 'reactiontype', 'interactiontype', 'action', 'type'],
  date: ['engagementdate', 'activitydate', 'occurredat', 'createddate', 'date', 'timestamp', 'time'],
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function guessMapping(headers: string[]): ColumnMapping {
  const used = new Set<string>()
  const mapping: ColumnMapping = {}
  for (const { field } of importFields) {
    const candidates = fieldCandidates[field]
    const match = headers.find((h) => {
      if (used.has(h)) return false
      const norm = normalize(h)
      return candidates.some((c) => norm.includes(c) || c.includes(norm))
    })
    if (match) {
      mapping[field] = match
      used.add(match)
    }
  }
  return mapping
}

function inferKind(raw: string | undefined): SignalKind {
  return (raw ?? '').toLowerCase().includes('comment') ? 'comment' : 'reaction'
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function parseDate(raw: string | undefined): string {
  if (!raw) return isoToday()
  const d = new Date(raw)
  return isNaN(d.getTime()) ? isoToday() : d.toISOString().slice(0, 10)
}

interface ContactGroup {
  linkedin_url: string
  name: string
  role_title: string | null
  company: string | null
  rows: number[]
}

function buildGroups(
  rows: Record<string, string>[],
  mapping: ColumnMapping,
): { groups: ContactGroup[]; rowErrors: RowError[] } {
  const nameCol = mapping.name
  const linkedinCol = mapping.linkedin_url
  const groupsByUrl = new Map<string, ContactGroup>()
  const rowErrors: RowError[] = []

  if (!nameCol || !linkedinCol) return { groups: [], rowErrors }

  rows.forEach((row, idx) => {
    const rowNum = idx + 1
    const linkedin_url = (row[linkedinCol] ?? '').trim()
    const name = (row[nameCol] ?? '').trim()
    if (!linkedin_url || !name) {
      rowErrors.push({ row: rowNum, message: `Missing ${!name ? 'name' : 'linkedin_url'}, row skipped` })
      return
    }
    let g = groupsByUrl.get(linkedin_url)
    if (!g) {
      g = {
        linkedin_url,
        name,
        role_title: mapping.role_title ? (row[mapping.role_title]?.trim() || null) : null,
        company: mapping.company ? (row[mapping.company]?.trim() || null) : null,
        rows: [],
      }
      groupsByUrl.set(linkedin_url, g)
    }
    g.rows.push(rowNum)
  })

  return { groups: Array.from(groupsByUrl.values()), rowErrors }
}

export function Import() {
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [existingUrls, setExistingUrls] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<ImportResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [showManualForm, setShowManualForm] = useState(false)
  const [manualForm, setManualForm] = useState<ManualForm>(emptyManualForm)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualMessage, setManualMessage] = useState<{ text: string; isError: boolean } | null>(null)

  async function handleManualAdd() {
    const name = manualForm.name.trim()
    if (!name) {
      setManualMessage({ text: 'Name is required.', isError: true })
      return
    }
    setManualSaving(true)
    setManualMessage(null)

    const linkedin_url = manualForm.linkedin_url.trim() || null
    const payload = {
      user_id: DEFAULT_USER_ID,
      name,
      role_title: manualForm.role_title.trim() || null,
      company: manualForm.company.trim() || null,
      linkedin_url,
      contact_type: manualForm.contact_type,
      stage: manualForm.stage,
    }

    const query = linkedin_url
      ? supabase.from('contact').upsert(payload, { onConflict: 'user_id,linkedin_url' })
      : supabase.from('contact').insert(payload)
    const { error } = await query

    setManualSaving(false)
    if (error) {
      setManualMessage({ text: error.message, isError: true })
      return
    }
    setManualMessage({ text: `${name} added.`, isError: false })
    setManualForm(emptyManualForm)
    if (linkedin_url) setExistingUrls((prev) => new Set(prev).add(linkedin_url))
  }

  const hasFile = headers.length > 0

  function handleFile(file: File) {
    setResult(null)
    setParseError(null)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields ?? []
        setHeaders(fields)
        setRows(results.data)
        setMapping(guessMapping(fields))
        supabase
          .from('contact')
          .select('linkedin_url')
          .eq('user_id', DEFAULT_USER_ID)
          .then(({ data }) => {
            setExistingUrls(new Set((data ?? []).map((c) => c.linkedin_url).filter((u): u is string => !!u)))
          })
      },
      error: (err) => setParseError(err.message),
    })
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const preview = useMemo(() => {
    const linkedinCol = mapping.linkedin_url
    if (!linkedinCol) return null
    const urls = new Set(rows.map((r) => (r[linkedinCol] ?? '').trim()).filter(Boolean))
    let known = 0
    for (const u of urls) if (existingUrls.has(u)) known++
    return { total: urls.size, known, fresh: urls.size - known }
  }, [rows, mapping.linkedin_url, existingUrls])

  const canImport = !!mapping.name && !!mapping.linkedin_url && rows.length > 0 && !importing

  async function runImport() {
    setImporting(true)
    setResult(null)
    const { groups, rowErrors } = buildGroups(rows, mapping)
    const errors: RowError[] = [...rowErrors]
    setProgress({ done: 0, total: groups.length + rows.length })

    const contactIdByUrl = new Map<string, string>()
    let contactsUpserted = 0

    for (const g of groups) {
      const { data, error } = await supabase
        .from('contact')
        .upsert(
          {
            user_id: DEFAULT_USER_ID,
            name: g.name,
            role_title: g.role_title,
            company: g.company,
            linkedin_url: g.linkedin_url,
            contact_type: 'unknown',
          },
          { onConflict: 'user_id,linkedin_url' },
        )
        .select('id')
        .single()

      if (error || !data) {
        for (const r of g.rows) errors.push({ row: r, message: `Contact upsert failed: ${error?.message ?? 'unknown error'}` })
      } else {
        contactIdByUrl.set(g.linkedin_url, data.id)
        contactsUpserted++
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }))
    }

    let signalsInserted = 0
    const linkedinCol = mapping.linkedin_url!
    const engagementCol = mapping.engagement_type
    const dateCol = mapping.date

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx]
      const rowNum = idx + 1
      const url = (row[linkedinCol] ?? '').trim()
      const contactId = contactIdByUrl.get(url)
      if (contactId) {
        const kind = inferKind(engagementCol ? row[engagementCol] : undefined)
        const occurred_at = parseDate(dateCol ? row[dateCol] : undefined)
        const detail = engagementCol ? row[engagementCol]?.trim() || null : null
        const { error } = await supabase.from('signal').insert({ contact_id: contactId, kind, detail, occurred_at })
        if (error) {
          errors.push({ row: rowNum, message: `Signal insert failed: ${error.message}` })
        } else {
          signalsInserted++
        }
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }))
    }

    setResult({ contactsUpserted, signalsInserted, errors })
    setImporting(false)
  }

  function reset() {
    setHeaders([])
    setRows([])
    setMapping({})
    setResult(null)
    setParseError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 920 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: showManualForm ? 16 : 0 }}>
        <button
          type="button"
          onClick={() => {
            setShowManualForm((v) => !v)
            setManualMessage(null)
          }}
          style={{ ...label, background: 'none', border: 'none', color: color.muted, cursor: 'pointer', textAlign: 'left', padding: 0 }}
        >
          {showManualForm ? '− Hide manual entry' : '+ Add a contact manually'}
        </button>

        {showManualForm && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              padding: 20,
              background: color.surface,
              border: `1px solid ${color.border}`,
              borderRadius: radius.lg,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              <Field label="Name *">
                <input
                  value={manualForm.name}
                  onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Jane Doe"
                  style={selectStyle}
                />
              </Field>
              <Field label="LinkedIn URL">
                <input
                  value={manualForm.linkedin_url}
                  onChange={(e) => setManualForm((f) => ({ ...f, linkedin_url: e.target.value }))}
                  placeholder="https://linkedin.com/in/..."
                  style={selectStyle}
                />
              </Field>
              <Field label="Role title">
                <input
                  value={manualForm.role_title}
                  onChange={(e) => setManualForm((f) => ({ ...f, role_title: e.target.value }))}
                  style={selectStyle}
                />
              </Field>
              <Field label="Company">
                <input
                  value={manualForm.company}
                  onChange={(e) => setManualForm((f) => ({ ...f, company: e.target.value }))}
                  style={selectStyle}
                />
              </Field>
              <Field label="Contact type">
                <select
                  value={manualForm.contact_type}
                  onChange={(e) => setManualForm((f) => ({ ...f, contact_type: e.target.value as ContactType }))}
                  style={selectStyle}
                >
                  {contactTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Stage">
                <select
                  value={manualForm.stage}
                  onChange={(e) => setManualForm((f) => ({ ...f, stage: e.target.value as Stage }))}
                  style={selectStyle}
                >
                  {stages.map((s) => (
                    <option key={s} value={s}>
                      {stageLabel[s]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                type="button"
                onClick={handleManualAdd}
                disabled={manualSaving}
                style={primaryButtonStyle(!manualSaving)}
              >
                {manualSaving ? 'Adding…' : 'Add contact'}
              </button>
              {manualMessage && (
                <span style={{ ...label, color: manualMessage.isError ? color.lime : color.accent }}>
                  {manualMessage.text}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {!hasFile && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `1px dashed ${dragOver ? color.accent : color.border}`,
            borderRadius: radius.lg,
            background: dragOver ? 'rgba(79,227,155,.06)' : color.surface,
            padding: 48,
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontFamily: font.body, fontSize: 15, color: color.text, marginBottom: 6 }}>
            Drop a CSV export here, or click to browse
          </div>
          <div style={{ ...label, color: color.muted }}>LinkedIn engagement export · .csv</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </div>
      )}

      {parseError && <div style={{ ...label, color: color.lime }}>Could not parse CSV: {parseError}</div>}

      {hasFile && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ ...label, color: color.muted }}>{rows.length} rows parsed</span>
            <button type="button" onClick={reset} style={ghostButtonStyle}>
              Choose a different file
            </button>
          </div>

          <div style={{ overflowX: 'auto', border: `1px solid ${color.border}`, borderRadius: radius.sm }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5, fontFamily: font.body }}>
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th key={h} style={thStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {headers.map((h) => (
                      <td key={h} style={tdStyle}>
                        {r[h]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ ...label, color: color.muted }}>Map columns</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {importFields.map(({ field, label: fieldLabel, required }) => (
                <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ ...label, color: color.dim, fontSize: 10 }}>
                    {fieldLabel}
                    {required ? ' *' : ''}
                  </span>
                  <select
                    value={mapping[field] ?? ''}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [field]: e.target.value || undefined }))
                    }
                    style={selectStyle}
                  >
                    <option value="">— none —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {preview && (
            <div style={{ ...label, color: color.text }}>
              {preview.total} contacts, {preview.fresh} new, {preview.known} already known
            </div>
          )}
          {!mapping.name || !mapping.linkedin_url ? (
            <div style={{ ...label, color: color.lime }}>Map at least Name and LinkedIn URL to import.</div>
          ) : null}

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button type="button" onClick={runImport} disabled={!canImport} style={primaryButtonStyle(canImport)}>
              {importing ? 'Importing…' : 'Import'}
            </button>
            {importing && (
              <span style={{ ...label, color: color.muted }}>
                {progress.done} / {progress.total}
              </span>
            )}
          </div>

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ ...label, color: color.accent }}>
                {result.contactsUpserted} contacts upserted, {result.signalsInserted} signals inserted
                {result.errors.length > 0 ? `, ${result.errors.length} errors` : ''}
              </div>
              {result.errors.length > 0 && (
                <div
                  style={{
                    border: `1px solid ${color.border}`,
                    borderRadius: radius.sm,
                    background: color.surface,
                    padding: 12,
                    maxHeight: 220,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  {result.errors.map((err, i) => (
                    <div key={i} style={{ ...label, color: color.muted, fontSize: 10.5 }}>
                      Row {err.row}: {err.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Field({ label: fieldLabel, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ ...label, color: color.dim, fontSize: 10 }}>{fieldLabel}</span>
      {children}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: `1px solid ${color.border}`,
  color: color.muted,
  fontFamily: font.mono,
  fontSize: 10,
  letterSpacing: '.08em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderBottom: `1px solid ${color.border}`,
  color: color.text,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: 220,
}

const selectStyle: React.CSSProperties = {
  background: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  padding: '8px 10px',
  color: color.text,
  fontFamily: font.body,
  fontSize: 13,
}

const ghostButtonStyle: React.CSSProperties = {
  ...label,
  background: 'transparent',
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  padding: '8px 12px',
  color: color.muted,
  cursor: 'pointer',
}

function primaryButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    ...label,
    background: enabled ? color.accent : color.surface,
    border: `1px solid ${enabled ? color.accent : color.border}`,
    borderRadius: radius.sm,
    padding: '10px 20px',
    color: enabled ? '#080908' : color.dim,
    cursor: enabled ? 'pointer' : 'not-allowed',
  }
}
