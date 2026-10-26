import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import '../styles/ApplicationDetails.css';

const API_URL = import.meta.env.VITE_LOCAL_API_URL;


const STATUS_META = {
  DRAFT:        { label: "Черновик",              kind: "draft",     step: 0 },
  SUBMITTED:    { label: "Отправлена",            kind: "pending",   step: 1 },
  ENRICHMENT:   { label: "Проверяем данные",      kind: "pending",   step: 1 },
  SCORING:      { label: "Оцениваем заявку",      kind: "pending",   step: 1 },
  UNDER_REVIEW: { label: "В рассмотрении банком", kind: "pending",   step: 2 },
  NEED_MORE_INFO:{ label: "Нужны данные",         kind: "need_info", step: 2 },
  COUNTEROFFER: { label: "Есть предложение",      kind: "offer",     step: 3 },
  APPROVED:     { label: "Одобрено",              kind: "approved",  step: 3 },
  DECLINED:     { label: "Отказано",              kind: "declined",  step: 3 },
  ACCEPTED:     { label: "Предложение принято",   kind: "completed", step: 3 },
  CANCELLED:    { label: "Отменена",              kind: "cancelled", step: 3 },
}

const STATUS_ALIASES = {
  CREATE:   "CREATED",
  SUBMIT:   "SUBMITTED",
  CLARIFY:  "CLARIFIED",
  APPROVE:  "APPROVED",
  DECLINE:  "DECLINED",
  REJECT:   "REJECTED",
  COMPLETE: "COMPLETED",
  ACCEPT:   "COMPLETED",
  ACCEPTED: "COMPLETED",
  CANCEL:   "CANCELLED",
}

function canonicalStatus(status) {
  return STATUS_ALIASES[status] || status
}

const FALLBACK_META = { label: "", kind: "unknown", step: 0 }

function metaOf(status) {
  return STATUS_META[canonicalStatus(status)] || { label: status, kind: "unknown", step: 0 }
}

function badgeClass(kind) {
  if (kind === "approved" || kind === "completed") return "badge-success"
  if (kind === "declined" || kind === "cancelled") return "badge-error"
  if (kind === "offer") return "badge-counter"
  if (kind === "pending" || kind === "need_info") return "badge-pending"
  return "badge-gray" // draft / unknown
}

// 4 канонических шага таймлайна (как на макете)
const STEPS = [
  "Заявка оформлена",
  "Проверка данных",
  "В рассмотрении банком",
  "Решение банка",
]

const FIELD_LABELS = {
  // ФНС
  ogrn: "ОГРН / ОГРНИП",
  companyName: "Название компании",
  registrationDate: "Дата регистрации",
  okved: "ОКВЭД",
  taxRegime: "Налоговый режим",
  mspCategory: "Категория МСП",
  status: "Статус организации",
  // БКИ
  existingDebt: "Действующие обязательства, ₽",
  activeLoans: "Количество активных кредитов",
  monthlyPayment: "Ежемесячный платёж по кредитам, ₽",
  delinquencies: "Просрочки за 12 месяцев",
  maxDelinquencyDays: "Максимальная просрочка, дней",
  // внутренние системы банка
  hasAccount: "Есть расчётный счёт в банке",
  avgMonthlyInflow: "Среднемесячные поступления, ₽",
  acquiringVolume: "Оборот по эквайрингу, ₽",
  annualRevenue: "Годовая выручка, ₽",
  monthlyRevenue: "Среднемесячная выручка, ₽",
}

const GROUP_FIELDS = {
  fns: ["ogrn", "companyName", "registrationDate", "okved", "taxRegime", "mspCategory", "status"],
  bki: ["existingDebt", "activeLoans", "monthlyPayment", "delinquencies", "maxDelinquencyDays"],
  internal: ["hasAccount", "avgMonthlyInflow", "acquiringVolume", "annualRevenue", "monthlyRevenue"],
}

// поля, которые вводятся числом
const NUMERIC_FIELDS = [
  "existingDebt", "activeLoans", "monthlyPayment", "maxDelinquencyDays",
  "avgMonthlyInflow", "acquiringVolume", "annualRevenue", "monthlyRevenue",
]

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "—"
  return Number(value).toLocaleString("ru-RU") + " ₽"
}

function formatDate(value) {
  if (!value) return ""
  const iso = String(value).replace(" ", "T")
  const d = new Date(iso)
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString("ru-RU") + " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
}


// GET /applications/:id  ->  одна заявка (local_id = :id)
function normalizeApplication(raw) {
  const app = raw.application || raw
  const meta = metaOf(app.status)
  return {
    // клиентские роуты и действия идут по local_id (!), global_id клиенту не нужен
    id: app.local_id ?? app.id ?? null,
    globalId: app.global_id ?? null,
    number: app.local_id ?? app.number ?? null,
    status: app.status ?? "",
    kind: meta.kind,
    step: meta.step,
    amount: app.loan_sum ?? app.amount ?? null,
    termMonths: app.loan_duration ?? app.termMonths ?? null,
    rate: app.loan_interest ?? app.rate ?? null,
    productName: app.productName ?? app.loan_name ?? app.product_name ?? "",
    purpose: app.purpose ?? "",
    createdAt: app.time_of_application ?? app.createdAt ?? app.created_at ?? null,
    // оффер / контр-оффер (придёт, когда бэк начнёт отдавать решение в деталях)
    offer: normalizeOffer(app.offer ?? app.decision),
    missing: normalizeMissing(app.missing_fields ?? app.missingFields),
    declineReason: app.decline_reason ?? app.declineReason ?? app.reason ?? "",
    reasons: app.reasons ?? app.reason_codes ?? [],
    tips: app.recommendations ?? app.tips ?? [],
  }
}

function normalizeOffer(offerRaw) {
  if (!offerRaw) return null
  return {
    amount: offerRaw.approved_amount ?? offerRaw.approvedAmount ?? null,
    termMonths: offerRaw.approved_term_months ?? offerRaw.approvedTermMonths ?? null,
    rate: offerRaw.approved_rate ?? offerRaw.approvedRate ?? null,
    monthlyPayment: offerRaw.monthly_payment ?? offerRaw.monthlyPayment ?? null,
    comment: offerRaw.comment ?? "",
  }
}

// missingFields -> { fns:[], bki:[], internal:[] }; если пусто/непонятно -
// вернём пустые группы, и форма покажет ВСЕ поля GROUP_FIELDS
function normalizeMissing(missing) {
  const empty = { fns: [], bki: [], internal: [] }
  if (!missing) return empty
  if (!Array.isArray(missing)) {
    return {
      fns: missing.fns ?? missing.FNS ?? missing.fns_data ?? [],
      bki: missing.bki ?? missing.BKI ?? missing.bki_data ?? [],
      internal: missing.internal ?? missing.INTERNAL ?? missing.internal_data ?? [],
    }
  }
  const result = { fns: [], bki: [], internal: [] }
  for (let i = 0; i < missing.length; i++) {
    const name = missing[i]
    const low = String(name).toLowerCase()
    if (low.indexOf("debt") >= 0 || low.indexOf("loan") >= 0 || low.indexOf("delinq") >= 0 ||
        low.indexOf("payment") >= 0 || low.indexOf("bki") >= 0 || low.indexOf("ogrn") < 0 && low.indexOf("max") >= 0) {
      result.bki.push(name)
    } else if (low.indexOf("revenue") >= 0 || low.indexOf("infl") >= 0 || low.indexOf("account") >= 0 ||
               low.indexOf("acquir") >= 0 || low.indexOf("internal") >= 0 || low.indexOf("bank") >= 0) {
      result.internal.push(name)
    } else {
      result.fns.push(name)
    }
  }
  return result
}

// GET /applications/:id/history -> лог смены статусов со временем
function normalizeHistoryEvent(raw, index) {
  return {
    id: raw.id ?? raw.log_id ?? index,
    status: raw.status ?? raw.new_status ?? raw.event_type ?? "",
    comment: raw.comment ?? raw.message ?? "",
    time: raw.created_at ?? raw.time ?? raw.timestamp ?? raw.at ?? null,
  }
}

// для шага таймлайна ищем в истории событие, чей статус мапится на этот шаг
function timeForStep(events, stepIndex) {
  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    const m = STATUS_META[canonicalStatus(ev.status)]
    if (m && m.step === stepIndex) return ev.time
  }
  return null
}


// ---- бейдж статуса ----
function StatusBadge(props) {
  const meta = metaOf(props.status)
  return <span className={"app-badge " + badgeClass(meta.kind)}>{meta.label}</span>
}


// ---- правый таймлайн ----
function Stepper(props) {
  const app = props.app
  const events = props.events || []
  const activeStep = app.step
  // шаг 0 "Заявка оформлена" считаем пройденным, как только заявка не черновик
  const submitted = app.kind !== "draft" && app.kind !== "unknown"

  return (
    <div className="app-stepper">
      {STEPS.map(function (stepTitle, i) {
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

        let dotCls = "app-dot app-dot-future"
        if (done) dotCls = "app-dot app-dot-done"
        if (active) dotCls = "app-dot app-dot-active"

        // дата: шаг 0 - из time_of_application заявки, остальные - из истории
        let dateText = ""
        if (i === 0 && submitted) dateText = formatDate(app.createdAt)
        else {
          const t = timeForStep(events, i)
          if (t) dateText = formatDate(t)
        }

        return (
          <div className="app-step" key={stepTitle}>
            <div className="app-step-left">
              <span className={dotCls}></span>
              {i < STEPS.length - 1 ? (
                <span className={"app-line " + (done || active ? "app-line-red" : "")}></span>
              ) : null}
            </div>
            <div className="app-step-text">
              <div className={"app-step-title " + (future ? "app-step-future" : "")}>{stepTitle}</div>
              {dateText ? <div className="app-step-date">{dateText}</div> : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}


// ---- предложение / контр-оффер ----
function OfferBlock(props) {
  const offer = props.offer
  const isCounter = props.isCounter

  return (
    <div className="app-offer">
      <div className="app-offer-title">
        {isCounter ? "Банк предлагает другие условия" : "Предложение банка"}
      </div>

      {isCounter ? (
        <div className="app-compare">
          <div className="app-compare-col">
            <span className="app-compare-label">Вы запрашивали</span>
            <span className="app-compare-value">{formatMoney(props.requestedAmount)}</span>
            <span className="app-compare-sub">{props.requestedTerm} мес</span>
          </div>
          <div className="app-compare-col app-compare-new">
            <span className="app-compare-label">Банк предлагает</span>
            <span className="app-compare-value">{formatMoney(offer.amount)}</span>
            <span className="app-compare-sub">{offer.termMonths} мес · {offer.rate}%</span>
          </div>
        </div>
      ) : (
        <div className="app-offer-params">
          <div className="app-offer-param">
            <span className="app-offer-label">Сумма</span>
            <span className="app-offer-value">{formatMoney(offer.amount)}</span>
          </div>
          <div className="app-offer-param">
            <span className="app-offer-label">Срок</span>
            <span className="app-offer-value">{offer.termMonths} мес</span>
          </div>
          <div className="app-offer-param">
            <span className="app-offer-label">Ставка</span>
            <span className="app-offer-value">{offer.rate} %</span>
          </div>
          {offer.monthlyPayment != null ? (
            <div className="app-offer-param">
              <span className="app-offer-label">Платёж</span>
              <span className="app-offer-value">{formatMoney(offer.monthlyPayment)}</span>
            </div>
          ) : null}
        </div>
      )}

      {offer.comment ? <p className="app-offer-comment">{offer.comment}</p> : null}
    </div>
  )
}


// ---- форма дозаполнения: три группы ----
function MissingFieldsForm(props) {
  const groups = [
    { key: "fns",      title: "Данные ФНС / ЕГРЮЛ" },
    { key: "bki",      title: "Данные БКИ" },
    { key: "internal", title: "Внутренние системы банка" },
  ]

  // какие поля показывать: точный список от бэка, либо все из группы
  function fieldsFor(groupKey) {
    const fromBackend = props.missing[groupKey] || []
    if (fromBackend.length > 0) return fromBackend
    return GROUP_FIELDS[groupKey] || []
  }

  function handleChange(groupKey, fieldName, value) {
    const next = {
      fns: Object.assign({}, props.formData.fns),
      bki: Object.assign({}, props.formData.bki),
      internal: Object.assign({}, props.formData.internal),
    }
    next[groupKey][fieldName] = value
    props.onChange(next)
  }

  return (
    <div className="app-missing">
      <p className="app-missing-lead">
        Для продолжения рассмотрения заполните недостающие данные.
      </p>

      {groups.map(function (g) {
        const fields = fieldsFor(g.key)
        if (fields.length === 0) return null

        return (
          <div className="app-field-group" key={g.key}>
            <div className="app-field-group-title">{g.title}</div>
            <div className="app-field-group-body">
              {fields.map(function (fieldName) {
                const isNumeric = NUMERIC_FIELDS.indexOf(fieldName) >= 0
                const label = FIELD_LABELS[fieldName] || fieldName
                const value = props.formData[g.key][fieldName] || ""
                return (
                  <label className="app-field" key={fieldName}>
                    <span className="app-field-label">{label}</span>
                    <input
                      className="app-field-input"
                      type={isNumeric ? "number" : "text"}
                      value={value}
                      onChange={(e) => handleChange(g.key, fieldName, e.target.value)}
                    />
                  </label>
                )
              })}
            </div>
          </div>
        )
      })}

      <button
        className="app-btn-red"
        disabled={props.submitting}
        onClick={props.onSubmit}
      >
        {props.submitting ? "Отправляем…" : "Сохранить и отправить"}
      </button>
    </div>
  )
}


function ApplicationDetails() {
  const navigate = useNavigate()
  const params = useParams()
  // :id в URL = local_id (клиентский контракт)
  const appId = params.id

  const [app, setApp] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notFound, setNotFound] = useState(false)

  const [formData, setFormData] = useState({ fns: {}, bki: {}, internal: {} })
  const [busy, setBusy] = useState(false)

  // первичная загрузка
  useEffect(function () {
    loadAll()
  }, [appId])

  // автообновление, пока заявка "в работе" (kind pending)
  useEffect(function () {
    if (!app) return
    if (app.kind !== "pending") return
    const timer = setInterval(function () {
      loadAll(true)
    }, 4000)
    return function () { clearInterval(timer) }
  }, [app && app.kind, appId])


  // ПРАВКА: два запроса вместо несуществующего /details
  async function loadAll(quiet) {
    if (!quiet) setLoading(true)
    setError("")

    const token = localStorage.getItem("token")
    const headers = {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    }

    try {
      // 1) сама заявка
      const resApp = await fetch(API_URL + "/api/applications/" + appId, { headers })
      if (resApp.status === 401) {
        localStorage.removeItem("token")
        navigate("/login")
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
        console.error("application: ответ не JSON", resApp.status, textApp.slice(0, 200))
        throw e
      }
      console.log("RAW application:", JSON.stringify(dataApp, null, 2)) // сверь имена

      if (!resApp.ok) {
        setError((dataApp && dataApp.message) || "Не удалось загрузить заявку")
        setLoading(false)
        return
      }

      // 2) история смены статусов
      let history = []
      try {
        const resHist = await fetch(API_URL + "/api/applications/" + appId + "/history", { headers })
        if (resHist.ok) {
          const textHist = await resHist.text()
          let dataHist = null
          try { dataHist = JSON.parse(textHist) } catch (e) {
            console.error("history: ответ не JSON", resHist.status, textHist.slice(0, 200))
          }
          console.log("RAW history:", JSON.stringify(dataHist, null, 2)) // сверь имена
          const arr = Array.isArray(dataHist) ? dataHist : (dataHist.history || dataHist.events || dataHist.logs || [])
          history = arr.map(normalizeHistoryEvent)
        }
      } catch (e) {
        console.error("history упал (не критично):", e)
      }

      const norm = normalizeApplication(dataApp)
      setApp(norm)
      setEvents(history)
      setNotFound(false)
      setFormData({ fns: {}, bki: {}, internal: {} })
    } catch (e) {
      console.error("loadAll упал:", e)
      setError("Сервер недоступен. Попробуйте обновить страницу")
    }

    setLoading(false)
  }


  // общий отправитель действий
  async function doAction(path, body) {
    setBusy(true)
    setError("")
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(API_URL + "/api/applications/" + appId + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: body ? JSON.stringify(body) : undefined,
      })

      if (response.status === 401) {
        localStorage.removeItem("token")
        navigate("/login")
        return
      }

      const rawText = await response.text()
      let data = null
      try { data = JSON.parse(rawText) } catch (e) {
        console.error("action: ответ не JSON", response.status, rawText.slice(0, 200))
        throw e
      }

      if (response.ok) {
        await loadAll(true) // перечитаем заявку + историю
      } else {
        setError((data && data.message) || "Не удалось выполнить действие")
      }
    } catch (e) {
      console.error("action упал:", e)
      setError("Сервер недоступен. Попробуйте ещё раз")
    }
    setBusy(false)
  }


  function handleSubmitDraft() {
    // submit по контракту ждёт { loan_id, loan_sum, loan_interest, loan_duration }
    doAction("/submit", {
      loan_id: app && app.loanId ? app.loanId : undefined,
      loan_sum: app ? app.amount : undefined,
      loan_interest: app ? app.rate : undefined,
      loan_duration: app ? app.termMonths : undefined,
    })
  }

  function handleClarify() {
    // ПРАВКА под контракт: тело { fns_data, bki_data, internal_data }
    doAction("/clarify", {
      fns_data: formData.fns,
      bki_data: formData.bki,
      internal_data: formData.internal,
    })
  }

  function handleAccept() {
    doAction("/accept", null)
  }

  function handleDeclineOffer() {
    doAction("/decline", null)
  }

  function handleLogout() {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    navigate("/login")
  }


  // ---- центр карточки по kind ----
  function renderCenter() {
    if (!app) return null
    const kind = app.kind

    if (kind === "draft") {
      return (
        <div className="app-center">
          <p className="app-center-text">Проверьте параметры заявки и отправьте её на рассмотрение.</p>
          <button className="app-btn-red" disabled={busy} onClick={handleSubmitDraft}>
            {busy ? "Отправляем…" : "Отправить заявку"}
          </button>
        </div>
      )
    }

    if (kind === "pending") {
      return (
        <div className="app-center">
          <p className="app-center-muted">Пока никаких действий не требуется</p>
        </div>
      )
    }

    if (kind === "need_info") {
      return (
        <MissingFieldsForm
          missing={app.missing}
          formData={formData}
          onChange={setFormData}
          submitting={busy}
          onSubmit={handleClarify}
        />
      )
    }

    if (kind === "approved") {
      return (
        <div className="app-center">
          <p className="app-center-text">
            Ваша заявка на получение кредита рассмотрена банком. Решение положительное.
          </p>
          {app.offer ? <OfferBlock offer={app.offer} isCounter={false} /> : null}
          <p className="app-center-muted">Нажмите «Принять предложение», чтобы подтвердить условия.</p>
          <button className="app-btn-red" disabled={busy} onClick={handleAccept}>
            {busy ? "Принимаем…" : "Принять предложение"}
          </button>
        </div>
      )
    }

    if (kind === "offer") { // контр-оффер
      return (
        <div className="app-center">
          <p className="app-center-text">Банк рассмотрел заявку и предложил другие условия.</p>
          {app.offer ? (
            <OfferBlock
              offer={app.offer}
              isCounter={true}
              requestedAmount={app.amount}
              requestedTerm={app.termMonths}
            />
          ) : null}
          <div className="app-two-buttons">
            <button className="app-btn-red" disabled={busy} onClick={handleAccept}>
              {busy ? "Принимаем…" : "Принять"}
            </button>
            <button className="app-btn-ghost" disabled={busy} onClick={handleDeclineOffer}>
              Отклонить
            </button>
          </div>
        </div>
      )
    }

    if (kind === "declined") {
      return (
        <div className="app-center">
          <p className="app-center-text">К сожалению, сейчас банк не может одобрить финансирование.</p>
          {app.declineReason ? <p className="app-decline-reason">{app.declineReason}</p> : null}
          {Array.isArray(app.reasons) && app.reasons.length > 0 ? (
            <ul className="app-reasons">
              {app.reasons.map(function (r, i) { return <li key={i}>— {r}</li> })}
            </ul>
          ) : null}
          {Array.isArray(app.tips) && app.tips.length > 0 ? (
            <ul className="app-tips">
              {app.tips.map(function (t, i) { return <li key={i}>• {t}</li> })}
            </ul>
          ) : null}
          <button className="app-btn-red" onClick={() => navigate("/smart-selection")}>
            Подобрать другой продукт
          </button>
        </div>
      )
    }

    if (kind === "completed") {
      return (
        <div className="app-center">
          <p className="app-center-text">
            Предложение принято. Кредит оформлен (выдача смоделирована в прототипе).
          </p>
        </div>
      )
    }

    if (kind === "cancelled") {
      return (
        <div className="app-center">
          <p className="app-center-muted">Вы отклонили предложение банка.</p>
          <button className="app-btn-red" onClick={() => navigate("/smart-selection")}>
            Подобрать другой продукт
          </button>
        </div>
      )
    }

    // unknown - безопасный fallback (НЕ подсвечивает "Решение банка")
    return (
      <div className="app-center">
        <p className="app-center-muted">Статус заявки: {app.status}</p>
      </div>
    )
  }


  return (
    <div className="app-page">
      <button className="app-logout" onClick={handleLogout} title="Выйти">
        <span className="material-symbols-outlined">door_open</span>
      </button>

      <div className="app-body">
        <aside className="app-sidebar">
          <div className="app-logo">
            <img src="../../public/assets/alfa-logo-full.svg" className="app-logo-img" alt="logo" />
          </div>
          <nav className="app-nav">
            <Link to="/" className="app-nav-item">
              <span className="material-symbols-outlined">home</span>
              Главная
            </Link>
            <Link to="/smart-selection" className="app-nav-item">
              <span className="material-symbols-outlined">savings</span>
              Подобрать финансирование
            </Link>
          </nav>
        </aside>

        <main className="app-main">
          <button className="app-back-pill" onClick={() => navigate("/")}>
            <span className="material-symbols-outlined">arrow_back</span> Назад на Главную
          </button>

          {loading && <p className="app-note">Загрузка…</p>}
          {!loading && notFound && (
            <p className="app-note app-note-error">Заявка не найдена или доступна только её владельцу.</p>
          )}
          {!loading && !notFound && error !== "" && (
            <p className="app-note app-note-error">{error}</p>
          )}

          {!loading && !notFound && app && (
            <div className="app-card">
              <div className="app-card-left">
                <div className="app-head">
                  <h1 className="app-title">Заявка № {app.number}</h1>
                  <StatusBadge status={app.status} />
                </div>
                <p className="app-subtitle">
                  Заявка от {formatDate(app.createdAt)}
                </p>

                <div className="app-summary">
                  <span className="app-summary-amount">{formatMoney(app.amount)}</span>
                  <span className="app-summary-term">на {app.termMonths} месяца</span>
                </div>
                {app.productName ? (
                  <div className="app-summary-product">{app.productName}</div>
                ) : null}

                {renderCenter()}
              </div>

              <Stepper app={app} events={events} />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default ApplicationDetails
