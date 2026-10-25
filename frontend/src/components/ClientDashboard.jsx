
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/ClientDashboard.css';

const API_URL = import.meta.env.LOCAL_API_URL;


const STATUS_MAP = {
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
}

// types of messages in teh feed
const FEED_TYPE_MAP = {
  STATUS_UPDATE: "Статус по заявке",
  ACTION_REQUIRED: "Нужно действие",
  OFFER_READY: "Предложение банка",
  RECOMMENDATION: "Рекомендация",
  TIP: "Подсказка",
}

function formatMoney(value) {
  if (value === null || value === undefined) return "—"
  return Number(value).toLocaleString("ru-RU") + " ₽"
}


function ApplicationCard(props) {
  const app = props.app
  const status = STATUS_MAP[app.status] || { label: app.status, cls: "badge-gray" }

  return (
    <div className="dash-app-card">
      <div className="dash-app-top">
        <span className="dash-app-num">№ {app.number}</span>
        {/* displaying interest rate only if backend sent it */}
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


// recommended offers
function OfferCard(props) {
  const rec = props.rec
  // variating color
  const colorCls = props.index % 2 === 0 ? "offer-blue" : "offer-peach"

  return (
    <div className={"dash-offer-card " + colorCls}>
      <div className="dash-offer-name">{rec.productName}</div>
      <div className="dash-offer-desc">{rec.description}</div>

      <div className="dash-offer-params">
        <div className="dash-offer-param">
          <span className="dash-offer-label">сумма до</span>
          <span className="dash-offer-value">{formatMoney(rec.maxAmount)}</span>
        </div>
        <div className="dash-offer-param">
          <span className="dash-offer-label">ставка от</span>
          <span className="dash-offer-value">{rec.baseRate} %</span>
        </div>
        <div className="dash-offer-param">
          <span className="dash-offer-label">срок до</span>
          <span className="dash-offer-value">{rec.maxTermMonths} мес</span>
        </div>
      </div>

      <button
        className="dash-btn-red"
        onClick={() => props.onApply(rec.productCode)}
      >
        Оформить
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

  const navigate = useNavigate()

  useEffect(() => {
    loadDashboard()
  }, [])


  async function loadDashboard() {
    setLoading(true)
    setError("")

    try {
      const token = localStorage.getItem("token")

      const response = await fetch(API_URL + "/api/client/dashboard", {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
      })

      // if token has expired, redirecting user to "/login"
      if (response.status === 401) {
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        navigate("/login")

        return
      }


      const data = await response.json()

      if (response.ok) {
        setUser(data.user)
        setCompany(data.company)
        setApplications(data.applications || [])
        setFeed(data.feed || [])
        setOffers(data.recommendations || [])
      } else {
        setError(data.message || "Не удалось загрузить данные")
      }
    } catch (e) {
      setError("Сервер недоступен. Попробуйте обновить страницу")
    }

    setLoading(false)
  }


  function handleOpenApplication(id) {
    navigate("/applications/" + id)
  }

/*
  function handleApplyProduct(code) {
    // уходим в подбор с предвыбранным продуктом
    navigate("/smart-selection?product=" + code)
  }
*/

  function handleLogout() {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    navigate("/login")
  }

  // greeting to be display
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
            <img src="../../public/assets/alfa-logo-full.svg" className="login-logo" />
          </div>

          <nav className="dash-nav">
            <Link to="/" className="dash-nav-item dash-nav-active">
              <span className="material-symbols-outlined">home</span>
              Главная
            </Link>
            <Link to="/smart-selection" className="dash-nav-item">
              <span className="dash-nav-icon">o</span>
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
              {/* левая колонка: заявки + лента */}
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
                    key={rec.productCode}
                    rec={rec}
                    index={index}
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

export default ClientDashboard;