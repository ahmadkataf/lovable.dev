import { useState } from 'react'
import { Database, FileArchive, RefreshCw, KeyRound, Table2 } from 'lucide-react'
import { Modal } from './modal'
import { Field } from './components'
import { pickFile } from '../lib/platform'
import {
  ameenProducts, LoginNeeded, openAccess, parseTable, rankTables, sqlAvailable, sqlScan, sqlTableRows, sqlTables,
  type AccessFile, type ImportKind, type Parsed, type SourceTable, type SqlDatabase, type SqlLogin,
} from '../lib/programImport'

const WHAT: Record<ImportKind, string> = { products: 'المواد (القطع)', customers: 'العملاء', suppliers: 'الموردين' }

/** Brings products, customers or suppliers over from the program the shop used before, straight from its database:
 *  الأمين and other SQL Server programs on this computer (Windows), or an Access file (.mdb / .accdb). What is read
 *  goes to the usual import preview; nothing is saved here and the other program's data is only read. */
export function ProgramImport({ kind, onParsed, onClose }: { kind: ImportKind; onParsed: (p: Parsed) => void; onClose: () => void }) {
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [login, setLogin] = useState<SqlLogin>({})
  // the program's server when it is another computer of the shop's network (الأمين's "server" PC): SERVER\SQLEXPRESS
  const [server, setServer] = useState('')
  const [askLogin, setAskLogin] = useState(false)
  const [dbs, setDbs] = useState<SqlDatabase[] | null>(null)
  const [noServer, setNoServer] = useState(false)
  // the tables of the chosen source: a database here, or an Access file
  const [src, setSrc] = useState<{ title: string; tables: SourceTable[]; read: (t: SourceTable) => Promise<unknown[][]> } | null>(null)
  const [all, setAll] = useState(false)
  const [pick, setPick] = useState<SourceTable | null>(null)
  const [accessPass, setAccessPass] = useState<{ file: File; pass: string } | null>(null)

  const run = async (label: string, job: () => Promise<void>) => {
    setBusy(label); setErr('')
    try { await job() } catch (e) {
      if (e instanceof LoginNeeded) { setAskLogin(true); setErr('رفض SQL Server الدخول بحساب ويندوز هذا. أدخل اسم المستخدم وكلمة المرور (من فني البرنامج القديم).') }
      else setErr((e as Error).message || 'تعذّرت القراءة')
    } finally { setBusy('') }
  }
  const scan = (l: SqlLogin = login) => run('نبحث عن قواعد البيانات…', async () => {
    const r = await sqlScan({ ...l, server: server.trim() || undefined })
    setNoServer(!r.servers.length)
    setDbs(r.found.sort((a, b) => Number(b.ameen) - Number(a.ameen) || a.database.localeCompare(b.database)))
    // refused (or the Windows sign-in did not work): a SQL login may still open it
    if (!r.found.length && r.failed.length) {
      setAskLogin(true)
      setErr(r.failed.some(f => f.login) ? 'رفض SQL Server الدخول بحساب ويندوز هذا. أدخل اسم المستخدم وكلمة المرور (من فني البرنامج القديم).' : `تعذّر الاتصال: ${r.failed.map(f => `${f.server}: ${f.error}`).join(' — ')}`)
    }
  })
  const chooseDb = (db: SqlDatabase) => run(db.ameen && kind === 'products' ? 'نقرأ مواد الأمين…' : 'نقرأ جداول قاعدة البيانات…', async () => {
    if (db.ameen && kind === 'products') {
      const rows = await ameenProducts(db, login)
      if (!rows.length) throw new Error('لم أجد مواد في قاعدة الأمين هذه')
      onParsed({ kind: 'products', rows, guessed: `من قاعدة بيانات برنامج الأمين «${db.database}»: ${rows.length} مادة مع أسعارها ومجموعاتها وكمياتها. راجعها قبل الاستيراد.` })
      return
    }
    const tables = await sqlTables(db, login)
    showTables(`${db.database} (${db.server})`, tables, t => sqlTableRows(db, t, login))
  })
  const showTables = (title: string, tables: SourceTable[], read: (t: SourceTable) => Promise<unknown[][]>) => {
    const ranked = rankTables(tables, kind)
    setSrc({ title, tables, read }); setAll(!ranked.length); setPick(ranked[0] ?? null)
  }
  const access = (file: File, pass?: string) => run('نقرأ ملف قاعدة البيانات…', async () => {
    let f: AccessFile
    try { f = await openAccess(file, pass) } catch (e) {
      console.warn('Access file', e)
      const m = String((e as Error).message || e)
      if (/password|encrypt|decrypt/i.test(m)) { setAccessPass({ file, pass: '' }); throw new Error(pass ? 'كلمة المرور غير صحيحة' : 'الملف محمي بكلمة مرور: أدخلها') }
      throw new Error('هذا الملف ليس قاعدة بيانات Access يمكن قراءتها')
    }
    setAccessPass(null)
    showTables(file.name, f.tables, async t => f.rows(t.name))
  })
  const readTable = () => pick && src && run(`نقرأ الجدول ${pick.name}…`, async () => {
    const grid = await src.read(pick)
    const parsed = parseTable(grid, kind)
    if (!parsed.rows.length) throw new Error('لم أجد في هذا الجدول عموداً للأسماء. اختر جدولاً آخر.')
    onParsed({ ...parsed, guessed: [`من الجدول «${pick.name}» في ${src.title}.`, parsed.guessed].filter(Boolean).join(' ') } as Parsed)
  })

  const ranked = src ? rankTables(src.tables, kind) : []
  const shown = src ? (all ? [...src.tables].sort((a, b) => b.rows - a.rows) : ranked.slice(0, 8)) : []
  return (
    <Modal title={`استيراد ${WHAT[kind]} من برنامج آخر`} onClose={onClose} size="wide" footer={src
      ? <><button className="btn primary" disabled={!pick || !!busy} onClick={() => void readTable()}><Table2 /> اقرأ هذا الجدول</button><button className="btn" onClick={() => { setSrc(null); setPick(null) }}>رجوع</button></>
      : <button className="btn" onClick={onClose}>إغلاق</button>}>
      {busy && <div className="card pad mb" style={{ padding: '10px 14px' }}><RefreshCw size={14} className="spin" style={{ verticalAlign: -2 }} /> {busy}</div>}
      {err && <div className="error mb">{err}</div>}

      {!src && <>
        <p className="help mb">ينقل {WHAT[kind]} من قاعدة بيانات البرنامج القديم مباشرة (قراءة فقط، لا يغيّر فيه شيئاً)، ثم تراجعها قبل الحفظ.</p>
        <div className="grid cols-2 mb">
          <button className="card pad" style={{ textAlign: 'start' }} disabled={!sqlAvailable() || !!busy} onClick={() => void scan()}>
            <b><Database size={16} style={{ verticalAlign: -3 }} /> برنامج على هذا الكمبيوتر</b>
            <div className="small muted mt">الأمين وكل البرامج التي تعمل على SQL Server. {sqlAvailable() ? 'شغّل كراج الرضوان على نفس الكمبيوتر الذي عليه البرنامج القديم.' : 'متاح في نسخة الويندوز.'}</div>
          </button>
          <button className="card pad" style={{ textAlign: 'start' }} disabled={!!busy} onClick={async () => { const f = await pickFile('.mdb,.accdb'); if (f) void access(f) }}>
            <b><FileArchive size={16} style={{ verticalAlign: -3 }} /> ملف قاعدة بيانات Access</b>
            <div className="small muted mt">ملف ‎.mdb أو ‎.accdb من البرامج التي تحفظ بياناتها فيه (يعمل على الكمبيوتر والهاتف).</div>
          </button>
        </div>
        {accessPass && <div className="row mb" style={{ gap: 8, alignItems: 'end' }}>
          <Field label="كلمة مرور ملف قاعدة البيانات"><input className="input" type="password" value={accessPass.pass} onChange={e => setAccessPass({ ...accessPass, pass: e.target.value })} /></Field>
          <button className="btn" onClick={() => void access(accessPass.file, accessPass.pass)}><KeyRound /> فتح</button>
        </div>}
        {askLogin && <div className="row mb" style={{ gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <Field label="اسم مستخدم SQL Server"><input className="input" dir="ltr" value={login.user ?? ''} onChange={e => setLogin({ ...login, user: e.target.value })} placeholder="sa" /></Field>
          <Field label="كلمة المرور"><input className="input" type="password" dir="ltr" value={login.password ?? ''} onChange={e => setLogin({ ...login, password: e.target.value })} /></Field>
          <button className="btn" disabled={!login.user || !!busy} onClick={() => void scan(login)}><KeyRound /> دخول</button>
        </div>}
        {dbs && !dbs.length && !askLogin && !busy && <div className="card pad tone-warning mb" style={{ padding: '10px 14px' }}>
          {noServer ? 'لا يوجد SQL Server على هذا الكمبيوتر. إن كان البرنامج القديم على كمبيوتر آخر في الشبكة (الخادم) فاكتب اسمه في الأسفل، أو شغّل كراج الرضوان على ذلك الكمبيوتر، أو صدّر بياناته إلى إكسل.' : 'لم أجد قواعد بيانات لبرامج على هذا الكمبيوتر.'}
        </div>}
        {sqlAvailable() && (askLogin || (dbs && !dbs.length)) && <div className="row mb" style={{ gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          <Field label="اسم الخادم (اختياري)" help="مثل SERVER\SQLEXPRESS: الكمبيوتر الذي عليه قاعدة البرنامج القديم"><input className="input" dir="ltr" value={server} onChange={e => setServer(e.target.value)} placeholder="SERVER\SQLEXPRESS" /></Field>
          {!askLogin && <button className="btn" disabled={!server.trim() || !!busy} onClick={() => void scan()}><Database /> بحث</button>}
        </div>}
        {dbs && dbs.length > 0 && <div className="list">
          {dbs.map(d => <button key={d.server + d.database} className="list-item" style={{ textAlign: 'start', width: '100%' }} disabled={!!busy} onClick={() => void chooseDb(d)}>
            <Database size={18} />
            <div className="grow"><div className="title">{d.database} {d.ameen && <span className="badge tone-success">برنامج الأمين</span>}</div>
              <div className="sub" dir="ltr" style={{ textAlign: 'end' }}>{d.server}</div></div>
            <span className="small muted">{d.ameen ? `${d.products ?? 0} مادة` : `${d.tables} جدول`}</span>
          </button>)}
        </div>}
      </>}

      {src && <>
        <p className="mb">في <b>{src.title}</b>: {ranked.length ? `الجداول الأرجح أولاً. اختر الجدول الذي فيه ${WHAT[kind]}:` : `لم أتعرّف على جدول ${WHAT[kind]} من أسماء أعمدته، فاختره بنفسك:`}</p>
        <label className="row small mb" style={{ gap: 6 }}><input type="checkbox" checked={all} onChange={e => setAll(e.target.checked)} /> كل الجداول ({src.tables.length})</label>
        <div className="list" style={{ maxHeight: 300, overflow: 'auto' }}>
          {shown.map(t => <label key={(t.schema ?? '') + t.name} className={`list-item ${pick === t ? 'active' : ''}`} style={{ cursor: 'pointer' }}>
            <input type="radio" name="tbl" checked={pick === t} onChange={() => setPick(t)} />
            <div className="grow" style={{ minWidth: 0 }}><div className="title" dir="ltr" style={{ textAlign: 'end' }}>{t.name}</div>
              <div className="sub" dir="ltr" style={{ textAlign: 'end', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.columns.join(', ')}</div></div>
            <span className="small muted">{t.rows} سطر</span>
          </label>)}
        </div>
      </>}
    </Modal>
  )
}
