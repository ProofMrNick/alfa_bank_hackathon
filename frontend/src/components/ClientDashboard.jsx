import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/ClientDashboard.css';

const API_URL = import.meta.env.VITE_LOCAL_API_URL;


const STATUS_MAP = {
<<<<<<< HEAD
  DRAFT:        { label: "Черновик",              cls: "badge-gray" },
  CREATE:      { label: "Создана",               cls: "badge-pending" },
  SUBMIT:    { label: "Отправлена",            cls: "badge-pending" },
  ENRICHMENT:   { label: "Проверяем данные",      cls: "badge-pending" },
  SCORING:      { label: "Оцениваем заявку",      cls: "badge-pending" },
  PENDING:      { label: "На рассмотрении",       cls: "badge-pending" },
  UNDER_REVIEW: { label: "В рассмотрении",        cls: "badge-pending" },
  CLARIFY:    { label: "Данные обновлены",      cls: "badge-pending" },
  NEED_INFO:    { label: "Нужны данные",          cls: "badge-orange" },
  REQUEST_INFO: { label: "Нужны данные",          cls: "badge-orange" },
  COUNTEROFFER: { label: "Есть предложение",      cls: "badge-purple" },
  APPROVE:     { label: "Одобрено",              cls: "badge-green" },
  DECLINE:     { label: "Отказано",              cls: "badge-red" },
  REJECT:     { label: "Отказано",              cls: "badge-red" },
  COMPLETE:    { label: "Завершена",             cls: "badge-green" },
  ACCEPT:      { label: "Завершена",             cls: "badge-green" }, 
  CANCEL:    { label: "Отменена",              cls: "badge-gray" },
}

// just in case backend sends data in past tense
const STATUS_ALIASES = {
  CREATED:   "CREATE",
  SUBMITTED: "SUBMIT",
  CLARIFIED: "CLARIFY",
  APPROVED:  "APPROVE",
  DECLINED:  "DECLINE",
  REJECTED:  "REJECT",
  COMPLETED: "COMPLETE",
  ACCEPTED:  "ACCEPT",
  CANCELLED: "CANCEL",
}

function canonicalStatus(status) {
  return STATUS_ALIASES[status] || status
=======
  DRAFT: { label: "Черновик", cls: "badge-gray" },
  SUBMITTED: { label: "Отправлена", cls: "badge-blue" },
  ENRICHMENT: { label: "Проверяем данные", cls: "badge-blue" },
  SCORING: { label: "Оцениваем заявку", cls: "badge-blue" },
  UNDER_REVIEW: { label: "В рассмотрении", cls: "badge-gray" },
  NEED_MORE_INFO: { label: "Нужны данные", cls: "badge-orange" },
  COUNTEROFFER: { label: "Есть предложение", cls: "badge-purple" },
  APPROVED: { label: "Одобрено", cls: "badge-green" },
  DECLINED: { label: "Отказано", cls: "badge-red" },
  COMPLETED: { label: "Завершена", cls: "badge-green" },
>>>>>>> af557a0a94b52ccee2e46e62551c295be6913ca1
}

// типы сообщений в ленте
const FEED_TYPE_MAP = {
  STATUS_UPDATE: "Статус по заявке",
  ACTION_REQUIRED: "Нужно действие",
  OFFER_READY: "Предложение банка",
  RECOMMENDATION: "Рекомендация",
  TIP: "Подсказка",
}

<<<<<<< HEAD
const FEED_STATUS_TITLE = {
  CREATE:       "Заявка создана",
  SUBMIT:       "Заявка отправлена",
  PENDING:      "Заявка на стадии рассмотрения",
  UNDER_REVIEW: "Заявка на стадии рассмотрения",
  ENRICHMENT:   "Проверяем данные",
  SCORING:      "Оцениваем заявку",
  NEED_INFO:    "Нужны дополнительные данные",
  REQUEST_INFO: "Нужны дополнительные данные",
  CLARIFY:      "Данные обновлены",
  COUNTEROFFER: "Банк предложил другие условия",
  APPROVE:      "Кредит одобрен",
  DECLINE:      "Отказ в предоставлении кредита",
  REJECT:       "Отказ в предоставлении кредита",
  COMPLETE:     "Кредит оформлен",
  ACCEPT:       "Кредит оформлен",
  CANCEL:       "Заявка отменена",
}


const FEED_STATUS_TEXT = {
  CREATE: "Мы приняли вашу заявку и начали обработку.",
  SUBMIT: "Заявка отправлена в банк.",
  PENDING: "Банк рассматривает вашу заявку. Никаких действий не требуется.",
  UNDER_REVIEW: "Банк рассматривает вашу заявку. Никаких действий не требуется.",
  ENRICHMENT: "Проверяем данные компании по внешним источникам.",
  SCORING: "Оцениваем кредитный риск по заявке.",
  NEED_INFO: "Заполните недостающие данные, чтобы продолжить рассмотрение.",
  REQUEST_INFO: "Заполните недостающие данные, чтобы продолжить рассмотрение.",
  CLARIFY: "Вы обновили данные, заявка снова на рассмотрении.",
  COUNTEROFFER: "Банк предложил скорректированные условия. Посмотрите детали в заявке.",
  APPROVE: "Банк готов предложить финансирование. Посмотрите условия в заявке.",
  DECLINE: "К сожалению, банк не смог одобрить финансирование.",
  REJECT: "К сожалению, банк не смог одобрить финансирование.",
  COMPLETE: "Предложение принято, кредит оформлен (выдача смоделирована).",
  ACCEPT:   "Вы приняли предложение банка. Кредит оформлен (выдача смоделирована).",
  CANCEL: "Вы отклонили предложение банка.",
}

=======
>>>>>>> af557a0a94b52ccee2e46e62551c295be6913ca1
function formatMoney(value) {
  if (value === null || value === undefined) return "—"
  return Number(value).toLocaleString("ru-RU") + " ₽"
}



// normalizers for raw data
function normalizeUserFromInfo(info) {
  if (!info) return null
  return {
    id: info.user_id ?? null,
    name: info.name ?? "",
    email: info.email ?? "",
    role: "CLIENT",
  }
}


function normalizeCompanyFromInfo(info) {
  if (!info) return null
  return {
    inn: info.inn ?? "",
    name: info.company_name ?? "",
  }
}

<<<<<<< HEAD

// ---------- продукт из products -> поля для OfferCard ----------
// режим 1 (сейчас): каталог id/name/interest_rate/duration/max_amount, itemId нет
// режим 2 (потом):  остатки сессий itemId/preliminaryLimit/preliminaryRate/termMonths
=======
// продукт из recommendations -> поля для OfferCard.
// Работает в двух режимах:
//   1) каталог (current): id / name / interest_rate / duration / max_amount, itemId нет
//   2) остатки сессий подбора (future): itemId / preliminaryLimit / preliminaryRate / termMonths
// Через ?? берём первое непустое, поэтому одна функция годится для обоих.
>>>>>>> af557a0a94b52ccee2e46e62551c295be6913ca1
function normalizeOffer(raw) {
  return {
    id: raw.id ?? raw.productId ?? null,
    itemId: raw.itemId ?? null,
    productCode: String(raw.id ?? raw.productId ?? ""),
    productName: raw.name ?? raw.productName ?? "",
    description: raw.description ?? "",
    maxAmount: raw.max_amount ?? raw.maxAmount ?? raw.preliminaryLimit ?? null,
    minAmount: raw.min_amount ?? raw.minAmount ?? null,
    baseRate: raw.interest_rate ?? raw.baseRate ?? raw.preliminaryRate ?? null,
    maxTermMonths: raw.duration ?? raw.maxTermMonths ?? raw.termMonths ?? null,
  }
}


function normalizeApplication(raw) {
  console.log("application raw:", raw)
  return {
<<<<<<< HEAD
    id: raw.local_id ?? raw.id ?? null,
    globalId: raw.global_id ?? null,
    number: raw.local_id ?? raw.number ?? null,
    status: raw.status ?? "",
    amount: raw.loan_sum ?? raw.amount ?? null,
    termMonths: raw.loan_duration ?? raw.termMonths ?? null,
    rate: raw.loan_interest ?? raw.rate ?? null,
    productName: raw.loan_name ?? raw.product_name ?? raw.productName ?? map[raw.loan_id] ?? "",
    purpose: raw.purpose ?? "",
    createdAt: raw.time_of_application ?? raw.created_at ?? null,
=======
    id: raw.id ?? raw.global_id ?? null,
    number: raw.number ?? raw.local_id ?? null,
    status: raw.status ?? "",
    amount: raw.amount ?? raw.loan_sum ?? null,
    termMonths: raw.termMonths ?? raw.loan_duration ?? null,
    rate: raw.rate ?? raw.loan_interest ?? null,
    productName: raw.productName ?? raw.loan_name ?? raw.product_name ?? "",
>>>>>>> af557a0a94b52ccee2e46e62551c295be6913ca1
  }
}


<<<<<<< HEAD
// ---------- элемент ленты (лог смены статуса) -> поля для FeedCard ----------
// appsList - уже нормализованные заявки, чтобы по application_global_id
// собрать сабтайтл "Заявка № X на Y ₽" как на макете.
function normalizeFeedItem(raw, appsList, index) {
  const linked = (appsList || []).find(function (a) {
    return a.globalId != null && a.globalId === raw.application_global_id
  })

  let subtitle = null
  if (linked) {
    subtitle = "Заявка № " + linked.number + " на " + formatMoney(linked.amount)
  } else if (raw.application_global_id != null) {
    subtitle = "Заявка (id " + raw.application_global_id + ")"
  }

  const status = canonicalStatus(raw.new_status ?? raw.status ?? "")
  const title = FEED_STATUS_TITLE[status] ?? status
  const text = isReadableComment(raw.comment)
    ? String(raw.comment)
    : (FEED_STATUS_TEXT[status] ?? "")

=======
function normalizeFeedItem(raw, index) {
  console.log("feed raw:", raw)
>>>>>>> af557a0a94b52ccee2e46e62551c295be6913ca1
  return {
    id: raw.id ?? raw.event_id ?? index,
    type: raw.event_type ?? raw.type ?? "STATUS_UPDATE",
    subtitle: raw.application_summary ?? raw.subtitle ?? null,
    title: raw.title ?? raw.event_title ?? "",
    text: raw.message ?? raw.text ?? raw.description ?? "",
  }
}

// comment бэкенда может быть техническим JSON-дампом (лог clarify/decision
// с перечнем rejected-полей). Такой «текст» в клиентскую ленту не пускаем.
function isReadableComment(comment) {
  if (comment == null) return false
  const s = String(comment).trim()
  if (s === "") return false
  if (s.charAt(0) === "{" || s.charAt(0) === "[") return false  // JSON/массив
  if (s.length > 200) return false                               // страховка от дампов без скобок
  return true
}



function ApplicationCard(props) {
  const app = props.app
  const status = STATUS_MAP[app.status] || { label: app.status, cls: "badge-gray" }

  return (
    <div className="dash-app-card">
      <div className="dash-app-top">
        <span className="dash-app-num">№ {app.number}</span>
        {app.rate ? <span className="dash-app-rate">{app.rate} %</span> : null}
        <span className="dash-app-term">{app.termMonths} мес</span>
        <span className={"dash-badge " + status.cls}>{status.label}</span>
      </div>

      <div className="dash-app-amount">{formatMoney(app.amount)}</div>
      <div className="dash-app-product">{app.productName}</div>

      <button className="dash-btn-red" onClick={() => props.onOpen(app.id)}>Открыть</button>
    </div>
  )
}


function FeedCard(props) {
  const item = props.item
  const typeLabel = FEED_TYPE_MAP[item.type] || "Новости"

  return (
    <div className="dash-feed-card">
      <div className="dash-feed-type">{typeLabel}</div>
      {item.subtitle ? <div className="dash-feed-sub">{item.subtitle}</div> : null}
      <div className="dash-feed-title">{item.title}</div>
      <div className="dash-feed-text">{item.text}</div>
    </div>
  )
}



function OfferCard(props) {
  const rec = props.rec
  const colorCls = props.index % 2 === 0 ? "offer-blue" : "offer-peach"

  const isBusy = props.applyingId != null && props.applyingId === rec.itemId
  const anyPending = props.applyingId != null

  return (
    <div className={"dash-offer-card " + colorCls}>
      <div className="dash-offer-name">{rec.productName}</div>
      {rec.description ? <div className="dash-offer-desc">{rec.description}</div> : null}

      <div className="dash-offer-params">
        <div className="dash-offer-param">
          <span className="dash-offer-label">сумма до</span>
          <span className="dash-offer-value">{formatMoney(rec.maxAmount)}</span>
        </div>
        <div className="dash-offer-param">
          <span className="dash-offer-label">ставка от</span>
          <span className="dash-offer-value">{rec.baseRate != null ? rec.baseRate + " %" : "—"}</span>
        </div>
        <div className="dash-offer-param">
          <span className="dash-offer-label">срок до</span>
          <span className="dash-offer-value">{rec.maxTermMonths != null ? rec.maxTermMonths + " мес" : "—"}</span>
        </div>
      </div>

      <button
        className="dash-btn-red"
        disabled={anyPending}
        onClick={() => props.onApply(rec)}
      >
        {isBusy ? "Оформляем…" : "Оформить"}
      </button>
    </div>
  )
}



function ClientDashboard() {
  const [user, setUser] = useState(null)
  const [company, setCompany] = useState(null)
  const [applications, setApplications] = useState([])
  const [feed, setFeed] = useState([])
  const [offers, setOffers] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [applyingId, setApplyingId] = useState(null)

  const navigate = useNavigate()

  useEffect(() => {
    loadDashboard()
  }, [])


  async function loadDashboard() {
    setLoading(true)
    setError("")

    try {
<<<<<<< HEAD
      const [dashRes, prodRes] = await Promise.all([
        fetch(API_URL + "/api/client/dashboard", { headers }),
        fetch(API_URL + "/api/products", { headers }).catch(function (e) {
          console.error("products упал (не критично):", e)
          return null
        }),
      ])
=======
      const token = localStorage.getItem("token")
>>>>>>> af557a0a94b52ccee2e46e62551c295be6913ca1

      const response = await fetch(API_URL + "/api/client/dashboard", {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
      })

      if (response.status === 401) {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        navigate("/login")
        return
      }

      const rawText = await response.text()
      let data = null
      try {
        data = JSON.parse(rawText)
      } catch (parseErr) {
        console.error("Ответ не JSON. Статус:", response.status, "Тело:", rawText.slice(0, 200))
        throw parseErr
      }

      if (response.ok) {
        setUser(normalizeUserFromInfo(data.userInfo))
        setCompany(normalizeCompanyFromInfo(data.userInfo))
        setApplications((data.applications || []).map(normalizeApplication))
        setFeed((data.latestApplicationsLog || []).map(normalizeFeedItem))
        setOffers((data.recommendations || []).map(normalizeOffer))
      } else {
        setError(data.message || "Не удалось загрузить данные")
      }
<<<<<<< HEAD

      // строим карту id продукта -> name из /api/products
      let productMap = {}
      let productsList = []
      if (prodRes && prodRes.ok) {
        try {
          const prodText = await prodRes.text()
          const prodData = JSON.parse(prodText)
          const list = Array.isArray(prodData) ? prodData : (prodData.products || prodData.loans || [])
          productsList = list
          for (let i = 0; i < list.length; i++) {
            const p = list[i]
            const pid = p.id ?? p.product_id ?? p.loan_id
            const pname = p.name ?? p.product_name ?? p.title ?? ""
            if (pid != null) productMap[pid] = pname
          }
        } catch (e) {
          console.error("products parse:", e)
        }
      }

      setUser(normalizeUserFromInfo(data.userInfo))
      setCompany(normalizeCompanyFromInfo(data.userInfo))

      // заявки нормализуем ПЕРВЫМИ (нужна productMap и globalId для ленты)
      const appsNorm = (data.applications || []).map(function (raw) {
        return normalizeApplication(raw, productMap)
      })
      setApplications(appsNorm)

      // ленту нормализуем ВТОРЫМИ (нужен appsNorm для сабтайтла)
      const feedNorm = (data.latestApplicationsLog || []).map(function (raw, idx) {
        return normalizeFeedItem(raw, appsNorm, idx)
      })
      setFeed(feedNorm)

      
      console.log("data.recommendations:", data.recommendations)
      console.log("data.products:", data.products)
      console.log("productsList:", productsList)

      let recsRaw = productsList
      if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        recsRaw = data.recommendations
      } else if (Array.isArray(data.products) && data.products.length > 0) {
        recsRaw = data.products
      }
      setOffers(recsRaw.map(normalizeOffer))
=======
>>>>>>> af557a0a94b52ccee2e46e62551c295be6913ca1
    } catch (e) {
      console.error("fetch упал:", e)
      setError("Сервер недоступен. Попробуйте обновить страницу")
    }

    setLoading(false)
  }


  function handleOpenApplication(id) {
    navigate("/applications/" + id)
  }


  // оформление предложения прямо на дашборде.
  // Работает ТОЛЬКО по itemId (остатки сессий подбора). Если itemId нет —
  // значит бэкенд отдаёт голый каталог, и корректную заявку по нему создать
  // нельзя (нет суммы/срока/цели клиента) -> честно ведём в подбор.
  async function handleApplyProduct(rec) {
    if (!rec.itemId) {
      navigate("/smart-selection")
      return
    }

    setApplyingId(rec.itemId)
    setError("")

    try {
      const token = localStorage.getItem("token")

      const response = await fetch(API_URL + "/api/applications/quick", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ recommendationItemId: rec.itemId }),
      })

      if (response.status === 401) {
        localStorage.removeItem("token")
        navigate("/login")
        return
      }

      const raw = await response.text()
      let data = null
      try {
        data = JSON.parse(raw)
      } catch (e) {
        console.error("quick: ответ не JSON", response.status, raw.slice(0, 200))
        throw e
      }

      if (response.ok) {
        navigate("/applications/" + data.id)
      } else {
        setError(data.message || "Не удалось оформить заявку")
      }
    } catch (e) {
      console.error("quick упал:", e)
      setError("Сервер недоступен. Попробуйте ещё раз")
    }

    setApplyingId(null)
  }


  function handleLogout() {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    localStorage.removeItem("userName")
    navigate("/login")
  }

  const firstName = user && user.name ? user.name.split(" ")[0] : "друг"
  const companyLine = company ? company.name : ""

  return (
    <div className="dash-page">
      <button className="dash-logout" onClick={handleLogout} title="Выйти">
        <span className="material-symbols-outlined">door_open</span>
      </button>

      <div className="dash-body">
        <aside className="dash-sidebar">
          <div className="dash-logo">
            <img src="../../public/assets/alfa-logo-full.svg" className="login-logo" alt="logo" />
          </div>

          <nav className="dash-nav">
            <Link to="/" className="dash-nav-item dash-nav-active">
              <span className="material-symbols-outlined">home</span>
              Главная
            </Link>
            <Link to="/smart-selection" className="dash-nav-item">
              <span className="material-symbols-outlined">savings</span>
              Подобрать финансирование
            </Link>
          </nav>
        </aside>

        <main className="dash-main">
          <header className="dash-header">
            <h1 className="dash-hello">Добрый день, {firstName}</h1>
            <p className="dash-company">{companyLine}</p>
          </header>

          {loading && <p className="dash-note">Загрузка…</p>}
          {!loading && error !== "" && <p className="dash-note dash-note-error">{error}</p>}

          {!loading && error === "" && (
            <div className="dash-grid">
              <div className="dash-col-left">
                <section className="dash-block">
                  <h2 className="dash-block-title">Ваши заявки</h2>

                  {applications.length === 0 && (
                    <p className="dash-empty">Заявок пока нет. Подберите финансирование.</p>
                  )}

                  <div className="dash-apps-row">
                    {applications.map((app) => (
                      <ApplicationCard
                        key={app.id}
                        app={app}
                        onOpen={handleOpenApplication}
                      />
                    ))}
                  </div>
                </section>

                <section className="dash-block">
                  <h2 className="dash-block-title">Лента для вас</h2>

                  {feed.length === 0 && (
                    <p className="dash-empty">Новых сообщений пока нет.</p>
                  )}

                  <div className="dash-feed-row">
                    {feed.map((item) => (
                      <FeedCard key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              </div>

              <aside className="dash-col-right">
                <h2 className="dash-block-title">Предложения</h2>

                {offers.length === 0 && (
                  <p className="dash-empty">
                    Пока нет персональных предложений. Загляните в подбор.
                  </p>
                )}

                {offers.map((rec, index) => (
                  <OfferCard
                    key={rec.id}
                    rec={rec}
                    index={index}
                    applyingId={applyingId}
                    onApply={handleApplyProduct}
                  />
                ))}
              </aside>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default ClientDashboard