
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import '../styles/BankApplicationDetails.css';

const API_URL = import.meta.env.VITE_LOCAL_API_URL;


const STATUS_META = {
  DRAFT:        { label: 'Черновик',          cls: 'badge-gray',    kind: 'draft',    step: 0 },
  CREATE:       { label: 'Создана',           cls: 'badge-gray',    kind: 'draft',    step: 0 },
  SUBMIT:       { label: 'Отправлена',        cls: 'badge-pending', kind: 'pending',  step: 1 },
  ENRICHMENT:   { label: 'Проверяем данные',  cls: 'badge-pending', kind: 'pending',  step: 1 },
  SCORING:      { label: 'Оцениваем заявку',  cls: 'badge-pending', kind: 'pending',  step: 1 },
  CLARIFY:      { label: 'Данные обновлены',  cls: 'badge-pending', kind: 'pending',  step: 1 },
  PENDING:      { label: 'В рассмотрении',    cls: 'badge-pending', kind: 'pending',  step: 2 },
  UNDER_REVIEW: { label: 'В рассмотрении',    cls: 'badge-pending', kind: 'pending',  step: 2 },
  NEED_INFO:    { label: 'Нужны данные',      cls: 'badge-pending', kind: 'pending',  step: 2 },
  REQUEST_INFO: { label: 'Нужны данные',      cls: 'badge-pending', kind: 'pending',  step: 2 },
  COUNTEROFFER: { label: 'Контр-оффер',       cls: 'badge-counter', kind: 'pending',  step: 3 },
  APPROVE:      { label: 'Одобрено',          cls: 'badge-success', kind: 'decision', step: 3 },
  DECLINE:      { label: 'Отказано',          cls: 'badge-error',   kind: 'decision', step: 3 },
  REJECT:       { label: 'Отказано',          cls: 'badge-error',   kind: 'decision', step: 3 },
  ACCEPT:       { label: 'Завершена',         cls: 'badge-success', kind: 'decision', step: 3 },
  COMPLETE:     { label: 'Завершена',         cls: 'badge-success', kind: 'decision', step: 3 },
  CANCEL:       { label: 'Отменена',          cls: 'badge-gray',    kind: 'decision', step: 3 },
}

// страховка: если бэк вдруг пришлёт прошедшее время
const STATUS_ALIASES = {
  CREATED: 'CREATE', SUBMITTED: 'SUBMIT', CLARIFIED: 'CLARIFY',
  APPROVED: 'APPROVE', ACCEPTED: 'ACCEPT', DECLINED: 'DECLINE',
  REJECTED: 'REJECT', COMPLETED: 'COMPLETE', CANCELLED: 'CANCEL',
}
function canonicalStatus(s) { return STATUS_ALIASES[s] || s }

function metaOf(status) {
  return STATUS_META[canonicalStatus(status)] || { label: status, cls: 'badge-gray', kind: 'unknown', step: 0 }
}

// статусы, после которых решение банка уже невозможно менять
const TERMINAL = ['APPROVE', 'DECLINE', 'REJECT', 'ACCEPT', 'COMPLETE', 'CANCEL']

// 4 шага таймлайна (как на макете)
const STEPS = ['Заявка оформлена', 'Проверяем данные', 'В рассмотрении банком', 'Решение банка']

// подписи типов рекомендации ML
const REC_LABEL = {
  APPROVE: 'одобрить',
  DECLINE: 'отклонить',
  COUNTEROFFER: 'контроффер',
  REQUEST_INFO: 'запросить данные',
}

function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '—'
  return Number(value).toLocaleString('ru-RU') + ' ₽'
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(String(value).replace(' ', 'T'))
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('ru-RU')
}

function formatDateTime(value) {
  if (!value) return ''
  const d = new Date(String(value).replace(' ', 'T'))
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

// сколько месяцев прошло с даты (для "возраст бизнеса N мес")
function monthsSince(value) {
  if (!value) return null
  const d = new Date(String(value).replace(' ', 'T'))
  if (isNaN(d.getTime())) return null
  const now = new Date()
  return (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
}

function riskLabel(score) {
  if (score === null || score === undefined) return ''
  if (score >= 700) return 'надежный'
  if (score >= 450) return 'средний'
  return 'рискованный'
}
function riskClass(score) {
  if (score === null || score === undefined) return 'bad-risk-bad'
  if (score >= 700) return 'bad-risk-good'
  if (score >= 450) return 'bad-risk-medium'
  return 'bad-risk-bad'
}

// ============================================================
// НОРМАЛИЗАТОРЫ (имена полей сверь по console.log после первого открытия)
// ============================================================

// GET /bank/applications/:applId
function normalizeApplication(raw) {
  const a = raw.application || raw
  const meta = metaOf(a.status)
  // рекомендация ML может лежать в разных полях - пробуем все
  const recRaw = a.ml_recommendation ?? a.recommendation ?? a.scoring ?? a.ml ?? null
  return {
    globalId: a.global_id ?? a.id ?? null,
    localId: a.local_id ?? null,
    inn: a.inn ?? '',
    loanId: a.loan_id ?? null,
    status: canonicalStatus(a.status ?? ''),
    kind: meta.kind,
    step: meta.step,
    amount: a.loan_sum ?? null,
    rate: a.loan_interest ?? null,
    termMonths: a.loan_duration ?? null,
    createdAt: a.time_of_application ?? a.created_at ?? null,
    riskScore: a.risk_score ?? null,
    rec: recRaw ? {
      type: canonicalStatus(recRaw.type ?? recRaw.decision ?? recRaw.recommendation_type ?? ''),
      amount: recRaw.approvedAmount ?? recRaw.approved_amount ?? null,
      termMonths: recRaw.approvedTermMonths ?? recRaw.approved_term_months ?? null,
      rate: recRaw.approvedRate ?? recRaw.approved_rate ?? null,
      confidence: recRaw.confidence ?? recRaw.uverennost ?? null,
      rationale: recRaw.rationale ?? recRaw.explanation ?? recRaw.comment ?? '',
    } : null,
  }
}

// GET /bank/clients/:inn -> { user_info, bki, fns, internal, risk_score_history }
function normalizeClient(raw) {
  if (!raw) return null
  const info = raw.user_info ?? raw.userInfo ?? {}
  const fns = raw.fns ?? {}
  const bki = raw.bki ?? {}
  const internal = raw.internal ?? {}
  const hist = raw.risk_score_history ?? []
  const lastRisk = hist.length > 0 ? (hist[hist.length - 1].risk_score ?? hist[hist.length - 1].score) : null

  return {
    name: fns.name ?? info.name ?? info.company_name ?? '',
    inn: info.inn ?? fns.inn ?? '',
    ogrn: fns.ogrn ?? fns.ogrnip ?? '',
    okved: fns.okved_main ?? fns.okved ?? '',
    orgStatus: fns.status ?? '',
    msp: fns.msp_category ?? '',
    regDate: fns.registration_date ?? null,
    tax: fns.tax_regime ?? '',
    annualRevenue: internal.annual_revenue ?? fns.annual_revenue ??
      (internal.avg_monthly_inflow != null ? internal.avg_monthly_inflow * 12 : null),
    monthlyRevenue: internal.avg_monthly_inflow ?? fns.avg_monthly_revenue ?? null,
    expenses: internal.avg_monthly_outflow ?? null,
    debt: bki.total_debt ?? null,            // null => "данные отсутствуют" красным
    monthlyPayment: bki.monthly_payment ?? null,
    delinquencies: bki.delinquencies_12m_count ?? null,
    riskScore: info.risk_score ?? lastRisk ?? null,
  }
}

// GET /bank/applications/:applId/history
function normalizeEvent(raw, index) {
  return {
    id: raw.id ?? index,
    status: canonicalStatus(raw.new_status ?? raw.status ?? ''),
    time: raw.timestamp ?? raw.created_at ?? null,
  }
}

// для шага таймлайна ищем первое событие с этим шагом
function timeForStep(events, stepIndex) {
  for (let i = 0; i < events.length; i++) {
    const m = STATUS_META[events[i].status]
    if (m && m.step === stepIndex) return events[i].time
  }
  return null
}

// простые плюсы/минусы для блока "Скоринг" (как на макете)
function buildProsCons(client, pdn, ltr, ageMonths) {
  const pros = []
  const cons = []
  if (ageMonths != null && ageMonths >= 24) pros.push('возраст бизнеса ' + ageMonths + ' мес')
  if (client && client.delinquencies === 0) pros.push('нет просрочек')
  if (ltr != null) pros.push('LTR ' + ltr + ' %')
  if (pdn != null && pdn > 30) cons.push('долговая нагрузка ' + pdn + '%')
  if (client && client.debt == null) cons.push('нет данных об обязательствах')
  return { pros: pros, cons: cons }
}


// ---- маленькая строка "подпись / значение" ----
function InfoRow(props) {
  return (
    <div className="bad-row">
      <span className="bad-row-label">{props.label}</span>
      {props.missing
        ? <span className="bad-row-value bad-value-missing">данные отсутствуют</span>
        : <span className="bad-row-value">{props.value}</span>}
    </div>
  )
}


// ---- правый таймлайн ----
function Stepper(props) {
  const app = props.app
  const events = props.events || []
  const activeStep = app.step
  const submitted = app.kind !== 'draft' && app.kind !== 'unknown'

  return (
    <div className="bad-stepper">
      {STEPS.map(function (title, i) {
        let done = false
        let active = false
        if (i === 0) {
          done = submitted && activeStep > 0
          active = submitted && activeStep === 0
        } else {
          done = i < activeStep
          active = i === activeStep
        }
        const future = !done && !active

        let dotCls = 'bad-dot bad-dot-future'
        if (done) dotCls = 'bad-dot bad-dot-done'
        if (active) dotCls = 'bad-dot bad-dot-active'

        let dateText = ''
        if (i === 0 && submitted) dateText = formatDateTime(app.createdAt)
        else {
          const t = timeForStep(events, i)
          if (t) dateText = formatDateTime(t)
        }

        return (
          <div className="bad-step" key={title}>
            <div className="bad-step-left">
              <span className={dotCls}></span>
              {i < STEPS.length - 1 ? (
                <span className={'bad-line ' + (done || active ? 'bad-line-red' : '')}></span>
              ) : null}
            </div>
            <div className="bad-step-text">
              <div className={'bad-step-title ' + (future ? 'bad-step-future' : '')}>{title}</div>
              {dateText ? <div className="bad-step-date">{dateText}</div> : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}


function BankApplicationDetails() {
  const navigate = useNavigate()
  const params = useParams()
  // :applId = global_id (банковский контракт)
  const applId = params.applId ?? params.id

  const [app, setApp] = useState(null)
  const [client, setClient] = useState(null)
  const [events, setEvents] = useState([])
  const [productName, setProductName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  // форма финального решения
  const [decisionType, setDecisionType] = useState('APPROVE')
  const [amount, setAmount] = useState('')
  const [term, setTerm] = useState('')
  const [rate, setRate] = useState('')
  const [reason, setReason] = useState('')
  const [prefilled, setPrefilled] = useState(false)
  const [busy, setBusy] = useState(false)


  useEffect(function () {
    loadAll()
  }, [applId])


  async function loadAll(quiet) {
    if (!quiet) setLoading(true)
    setError('')

    const token = localStorage.getItem('token')
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + token,
    }

    try {
      // 1) сама заявка
      const resApp = await fetch(API_URL + '/api/bank/applications/' + applId, { headers })
      if (resApp.status === 401 || resApp.status === 403) {
        localStorage.removeItem('token')
        localStorage.removeItem('role')
        navigate('/login')
        return
      }
      if (resApp.status === 404) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const textApp = await resApp.text()
      let dataApp = null
      try { dataApp = JSON.parse(textApp) } catch (e) {
        console.error('bank application: ответ не JSON', resApp.status, textApp.slice(0, 200))
        throw e
      }
      console.log('RAW bank application:', JSON.stringify(dataApp, null, 2)) // сверь имена

      if (!resApp.ok) {
        setError((dataApp && dataApp.message) || 'Не удалось загрузить заявку')
        setLoading(false)
        return
      }

      const normApp = normalizeApplication(dataApp)
      setApp(normApp)

      // 2) история + клиент + продукты параллельно
      const results = await Promise.all([
        fetch(API_URL + '/api/bank/applications/' + applId + '/history', { headers }).catch(function () { return null }),
        normApp.inn
          ? fetch(API_URL + '/api/bank/clients/' + encodeURIComponent(normApp.inn), { headers }).catch(function () { return null })
          : Promise.resolve(null),
        fetch(API_URL + '/api/products', { headers }).catch(function () { return null }),
      ])

      // история
      let history = []
      if (results[0] && results[0].ok) {
        try {
          const d = JSON.parse(await results[0].text())
          console.log('RAW bank history:', JSON.stringify(d, null, 2))
          const arr = Array.isArray(d) ? d : (d.history || d.logs || [])
          history = arr.map(normalizeEvent)
        } catch (e) { console.error('history parse:', e) }
      }
      setEvents(history)

      // клиент (ФНС/БКИ/internal)
      let clientData = null
      if (results[1] && results[1].ok) {
        try {
          clientData = JSON.parse(await results[1].text())
          console.log('RAW bank client:', JSON.stringify(clientData, null, 2))
        } catch (e) { console.error('client parse:', e) }
      }
      setClient(normalizeClient(clientData))

      // имя продукта по loan_id
      if (results[2] && results[2].ok) {
        try {
          const d = JSON.parse(await results[2].text())
          const list = Array.isArray(d) ? d : (d.products || d.loans || [])
          for (let i = 0; i < list.length; i++) {
            const pid = list[i].id ?? list[i].loan_id
            if (pid === normApp.loanId) {
              setProductName(list[i].name ?? '')
              break
            }
          }
        } catch (e) { console.error('products parse:', e) }
      }

      // пре-fill формы решения из рекомендации ML (один раз)
      if (!prefilled) {
        const rec = normApp.rec
        setAmount(String(rec && rec.amount != null ? rec.amount : (normApp.amount ?? '')))
        setTerm(String(rec && rec.termMonths != null ? rec.termMonths : (normApp.termMonths ?? '')))
        setRate(String(rec && rec.rate != null ? rec.rate : (normApp.rate ?? '')))
        if (rec && rec.type) setDecisionType(rec.type)
        setPrefilled(true)
      }
    } catch (e) {
      console.error('loadAll упал:', e)
      setError('Сервер недоступен. Попробуйте обновить страницу')
    }

    setLoading(false)
  }


  // POST /bank/applications/:applId/decision
  async function sendDecision(body) {
    setBusy(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(API_URL + '/api/bank/applications/' + applId + '/decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify(body),
      })

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('token')
        localStorage.removeItem('role')
        navigate('/login')
        return
      }

      const rawText = await response.text()
      let data = null
      try { data = JSON.parse(rawText) } catch (e) {
        console.error('decision: ответ не JSON', response.status, rawText.slice(0, 200))
        throw e
      }

      if (response.ok) {
        await loadAll(true) // перечитаем заявку и историю
      } else {
        setError((data && data.message) || 'Не удалось принять решение')
      }
    } catch (e) {
      console.error('decision упал:', e)
      setError('Сервер недоступен. Попробуйте ещё раз')
    }
    setBusy(false)
  }


  // "Запросить данные" -> decision type REQUEST_INFO + список пустых полей
  function handleRequestData() {
    sendDecision({
      type: 'REQUEST_INFO',
      approvedAmount: null,
      approvedTermMonths: null,
      approvedRate: null,
      missingFields: missingKeys,
      reason: '',
      comment: 'Запрошены отсутствующие данные: ' + missingKeys.join(', '),
    })
  }


  // "Подтвердить" -> decision type APPROVE / DECLINE / COUNTEROFFER
  function handleConfirm() {
    if (decisionType === 'DECLINE' && reason.trim() === '') {
      setError('Укажите причину отказа')
      return
    }
    if (decisionType !== 'DECLINE') {
      if (!Number(amount) || !Number(term)) {
        setError('Укажите сумму и срок решения')
        return
      }
    }

    sendDecision({
      type: decisionType,
      approvedAmount: decisionType === 'DECLINE' ? null : Number(amount),
      approvedTermMonths: decisionType === 'DECLINE' ? null : Number(term),
      approvedRate: decisionType === 'DECLINE' ? null : Number(rate),
      missingFields: [],
      reason: decisionType === 'DECLINE' ? reason.trim() : '',
      comment: decisionType === 'DECLINE' ? reason.trim() : '',
    })
  }


  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('userName')
    navigate('/login')
  }


  // ---------- производные значения для блоков ----------
  const ageMonths = client ? monthsSince(client.regDate) : null
  const pdn = (client && client.monthlyRevenue && client.monthlyPayment)
    ? Math.round(client.monthlyPayment / client.monthlyRevenue * 100)
    : null
  const ltr = (client && client.annualRevenue && app && app.amount)
    ? Math.round(app.amount / client.annualRevenue * 100)
    : null
  const prosCons = buildProsCons(client, pdn, ltr, ageMonths)
  const risk = client ? client.riskScore : (app ? app.riskScore : null)

  // поля, которых нет -> их имена шлём в missingFields
  const missingKeys = []
  if (client && client.debt == null) missingKeys.push('total_debt')
  if (client && client.monthlyRevenue == null) missingKeys.push('avg_monthly_inflow')
  if (client && client.expenses == null) missingKeys.push('avg_monthly_outflow')

  const isTerminal = app ? TERMINAL.indexOf(app.status) >= 0 : false
  const rec = app ? app.rec : null
  const recTypeCls = rec
    ? (rec.type === 'APPROVE' ? 'bad-rec-good' : rec.type === 'DECLINE' ? 'bad-rec-bad' : 'bad-rec-counter')
    : ''


  return (
    <div className="bad-page">
      <button className="bad-logout" onClick={handleLogout} title="Выйти">
        <span className="material-symbols-outlined">door_open</span>
      </button>

      <div className="bad-body">
        {/* левая панель - как на всех банковских страницах */}
        <aside className="bad-sidebar">
          <div className="bad-logo">
            <img src="../../public/assets/alfa-logo-full.svg" className="login-logo" alt="logo" />
          </div>
          <nav className="bad-nav">
            <Link to="/bank" className="bad-nav-item">
              <span className="material-symbols-outlined">home</span>
              Главная
            </Link>
          </nav>
        </aside>

        <main className="bad-main">
          <button className="bad-back-pill" onClick={() => navigate('/bank')}>
            <span className="material-symbols-outlined">arrow_back</span> Назад на Главную
          </button>

          {loading && <p className="bad-note">Загрузка…</p>}
          {!loading && notFound && (
            <p className="bad-note bad-note-error">Заявка не найдена.</p>
          )}
          {!loading && !notFound && error !== '' && (
            <p className="bad-note bad-note-error">{error}</p>
          )}

          {!loading && !notFound && app && (
            <div className="bad-card">
              <div className="bad-card-left">
                {/* шапка */}
                <div className="bad-head">
                  <h1 className="bad-title">Заявка № {app.globalId}</h1>
                  <span className={'bad-badge ' + metaOf(app.status).cls}>{metaOf(app.status).label}</span>
                </div>
                <p className="bad-subtitle">Заявка от {formatDate(app.createdAt)}</p>

                <div className="bad-summary">
                  <span className="bad-summary-amount">{formatMoney(app.amount)}</span>
                  {app.rate != null ? <span className="bad-summary-rate">{app.rate} %</span> : null}
                  <span className="bad-summary-term">{app.termMonths} мес</span>
                </div>
                {productName ? <div className="bad-product">{productName}</div> : null}

                {/* две колонки данных о заявителе */}
                <div className="bad-cols">
                  <div className="bad-col">
                    <h3 className="bad-col-title">Заявитель и организация</h3>
                    <InfoRow label="заявитель" value={client ? client.name : '—'} />
                    <InfoRow label="ИНН" value={client ? client.inn : app.inn} />
                    <InfoRow label="ОГРНИП" value={client ? client.ogrn : '—'} />
                    <InfoRow label="ОКВЭД" value={client ? client.okved : '—'} />
                    <InfoRow label="статус организации" value={client ? client.orgStatus : '—'} />
                    <InfoRow label="категория МСП" value={client ? client.msp : '—'} />
                    <InfoRow
                      label="дата регистрации организации"
                      value={client && client.regDate
                        ? formatDate(client.regDate) + (ageMonths != null ? ' (' + ageMonths + ' мес.)' : '')
                        : '—'}
                    />
                    <InfoRow label="налоговый режим" value={client ? client.tax : '—'} />
                  </div>

                  <div className="bad-col">
                    <h3 className="bad-col-title">Финансы и нагрузка</h3>
                    <InfoRow label="годовая выручка" value={client && client.annualRevenue != null ? formatMoney(client.annualRevenue) : null} missing={client && client.annualRevenue == null} />
                    <InfoRow label="среднемесячная выручка" value={client && client.monthlyRevenue != null ? formatMoney(client.monthlyRevenue) : null} missing={client && client.monthlyRevenue == null} />
                    <InfoRow label="расходы" value={client && client.expenses != null ? formatMoney(client.expenses) : null} missing={client && client.expenses == null} />
                    <InfoRow label="действующие обязательства" value={client && client.debt != null ? formatMoney(client.debt) : null} missing={client && client.debt == null} />
                    <InfoRow label="ПДН" value={pdn != null ? '~ ' + pdn + '%' : null} missing={pdn == null} />
                    <InfoRow label="LTR" value={ltr != null ? '~ ' + ltr + ' %' : null} missing={ltr == null} />
                    <InfoRow
                      label="просрочки за 12 месяцев"
                      value={client && client.delinquencies != null ? (client.delinquencies === 0 ? 'нет' : client.delinquencies) : null}
                      missing={client && client.delinquencies == null}
                    />
                  </div>
                </div>

                {/* запрос данных у заявителя */}
                {!isTerminal && (
                  <div className="bad-request-wrap">
                    <button className="bad-btn-red" disabled={busy} onClick={handleRequestData}>
                      {busy ? 'Отправляем…' : 'Запросить данные'}
                    </button>
                    <p className="bad-caption">
                      Запросить отсутствующие данные у заявителя. После нажатия заявка вернется заявителю
                    </p>
                  </div>
                )}

                {/* скоринг + рекомендация */}
                <div className="bad-cols">
                  <div className="bad-col">
                    <h3 className="bad-col-title">Скоринг</h3>
                    <div className="bad-row">
                      <span className="bad-row-label">риск-балл</span>
                      <span className={'bad-row-value ' + riskClass(risk)}>
                        {risk != null ? risk + (riskLabel(risk) ? ' (' + riskLabel(risk) + ')' : '') : '—'}
                      </span>
                    </div>
                    <div className="bad-proscons">
                      <div className="bad-proscons-col">
                        <span className="bad-row-label">достоинства</span>
                        {prosCons.pros.length === 0 ? <span className="bad-row-value">—</span> : null}
                        {prosCons.pros.map(function (p) {
                          return <span className="bad-row-value" key={p}>+ {p}</span>
                        })}
                      </div>
                      <div className="bad-proscons-col">
                        <span className="bad-row-label">недостатки</span>
                        {prosCons.cons.length === 0 ? <span className="bad-row-value">—</span> : null}
                        {prosCons.cons.map(function (c) {
                          return <span className="bad-row-value" key={c}>- {c}</span>
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="bad-col">
                    <h3 className="bad-col-title">Рекомендация</h3>
                    <div className="bad-row">
                      <span className="bad-row-label">решение</span>
                      <span className="bad-row-value">
                        {rec
                          ? <span className={recTypeCls}>
                              {REC_LABEL[rec.type] ?? rec.type}
                              {rec.amount != null ? ' (' + formatMoney(rec.amount) + ', ' + rec.termMonths + ' мес, ' + rec.rate + '%)' : ''}
                            </span>
                          : '—'}
                      </span>
                    </div>
                    <div className="bad-row">
                      <span className="bad-row-label">уверенность</span>
                      <span className="bad-row-value">{rec && rec.confidence != null ? rec.confidence + ' %' : '—'}</span>
                    </div>
                    {rec && rec.rationale ? (
                      <div className="bad-row">
                        <span className="bad-row-label">обоснование</span>
                        <p className="bad-rationale">{rec.rationale}</p>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* финальное решение сотрудника */}
                {isTerminal ? (
                  <div className="bad-decision">
                    <h3 className="bad-col-title">Финальное решение</h3>
                    <p className="bad-note">По заявке уже принято решение: {metaOf(app.status).label}.</p>
                  </div>
                ) : (
                  <div className="bad-decision">
                    <h3 className="bad-col-title">Финальное решение</h3>

                    <div className="bad-decision-row">
                      <div className="bad-pills">
                        <button
                          className={'bad-pill ' + (decisionType === 'APPROVE' ? 'bad-pill-active' : '')}
                          onClick={() => setDecisionType('APPROVE')}
                        >
                          Одобрить
                        </button>
                        <button
                          className={'bad-pill ' + (decisionType === 'DECLINE' ? 'bad-pill-active' : '')}
                          onClick={() => setDecisionType('DECLINE')}
                        >
                          Отклонить
                        </button>
                        <button
                          className={'bad-pill ' + (decisionType === 'COUNTEROFFER' ? 'bad-pill-active' : '')}
                          onClick={() => setDecisionType('COUNTEROFFER')}
                        >
                          Контрпредложение
                        </button>
                      </div>

                      {decisionType === 'DECLINE' ? (
                        <div className="bad-inputs">
                          <input
                            className="bad-input bad-input-wide"
                            type="text"
                            placeholder="Причина отказа"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                        </div>
                      ) : (
                        <div className="bad-inputs">
                          <input
                            className="bad-input bad-input-wide"
                            type="number"
                            placeholder="Сумма"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                          />
                          <div className="bad-inputs-small">
                            <input
                              className="bad-input"
                              type="number"
                              placeholder="Срок, мес"
                              value={term}
                              onChange={(e) => setTerm(e.target.value)}
                            />
                            <input
                              className="bad-input"
                              type="number"
                              placeholder="Ставка, %"
                              value={rate}
                              onChange={(e) => setRate(e.target.value)}
                            />
                          </div>
                          <p className="bad-inputs-caption">Внесите изменения в заявленные данные, если необходимо</p>
                        </div>
                      )}
                    </div>

                    <div className="bad-confirm-wrap">
                      <button className="bad-btn-red" disabled={busy} onClick={handleConfirm}>
                        {busy ? 'Отправляем…' : 'Подтвердить'}
                      </button>
                      <p className="bad-caption">
                        Подтвердить выбранное действие и передать заявку клиенту
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* правый таймлайн */}
              <Stepper app={app} events={events} />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default BankApplicationDetails