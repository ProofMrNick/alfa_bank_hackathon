
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/BankDashboard.css';


const API_URL = import.meta.env.VITE_LOCAL_API_URL;


const STATUS_MAP = {
  DRAFT:        { label: "Черновик",            cls: "badge-gray" },
  CREATE:      { label: "Создана",             cls: "badge-gray" },
  SUBMIT:    { label: "Отправлена",          cls: "badge-pending" },
  ENRICHMENT:   { label: "Проверяем данные",    cls: "badge-pending" },
  SCORING:      { label: "Оцениваем заявку",    cls: "badge-pending" },
  PENDING:      { label: "В рассмотрении",      cls: "badge-pending" },
  UNDER_REVIEW: { label: "В рассмотрении",      cls: "badge-pending" },
  CLARIFY:    { label: "Данные обновлены",    cls: "badge-pending" },
  NEED_INFO:    { label: "Нужны данные",        cls: "badge-pending" },
  REQUEST_INFO: { label: "Нужны данные",        cls: "badge-pending" },
  COUNTEROFFER: { label: "Контр-оффер",         cls: "badge-counter" },
  APPROVE:     { label: "Одобрено",            cls: "badge-success" },
  DECLINE:     { label: "Отказано",            cls: "badge-error" },
  REJECT:     { label: "Отказано",            cls: "badge-error" },
  COMPLETE:    { label: "Завершена",           cls: "badge-success" },
  ACCEPT:      { label: "Завершена",           cls: "badge-success" },
  CANCEL:    { label: "Отменена",            cls: "badge-gray" },
}


const STATUS_ALIASES = {
  CREATED:    "CREATE",
  SUBMITTED:  "SUBMIT",
  CLARIFIED:  "CLARIFY",
  APPROVED:   "APPROVE",
  ACCEPTED:   "ACCEPT",
  DECLINED:   "DECLINE",
  REJECTED:   "REJECT",
  COMPLETED:  "COMPLETE",
  CANCELLED:  "CANCEL",
}

function canonicalStatus(status) {
  return STATUS_ALIASES[status] || status
}

function formatMoney(value) {
  if (value === null || value === undefined) return "—"
  return Number(value).toLocaleString("ru-RU") + " ₽"
}


function formatDate(value) {
  if (!value) return ""
  const d = new Date(String(value).replace(" ", "T"))
  if (isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString("ru-RU") + " " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
}


function riskClass(score) {
  if (score === null || score === undefined) return ""
  if (score >= 700) return "risk-good"
  if (score >= 450) return "risk-medium"
  return "risk-bad"
}


function normalizeBankApplication(raw, index) {
  return {
    globalId: raw.global_id ?? raw.id ?? null,
    localId: raw.local_id ?? null,
    userId: raw.user_id ?? null,
    inn: raw.inn ?? "",
    riskScore: raw.risk_score ?? raw.score ?? null,
    amount: raw.loan_sum ?? raw.amount ?? null,
    rate: raw.loan_interest ?? raw.rate ?? null,
    termMonths: raw.loan_duration ?? raw.termMonths ?? null,
    status: canonicalStatus(raw.status ?? ""),
    createdAt: raw.time_of_application ?? raw.created_at ?? null,
  }
}


function BankDashboard() {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const navigate = useNavigate()

  useEffect(function () {
    loadQueue()
  }, [])


  async function loadQueue() {
    setLoading(true)
    setError("")

    try {
      const token = localStorage.getItem("token")

      const response = await fetch(API_URL + "/api/bank/applications", {
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
      })

      // токен протух или роль не сотрудника - на логин
      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token")
        localStorage.removeItem("role")
        navigate("/login")
        return
      }

      const rawText = await response.text()
      let data = null
      try {
        data = JSON.parse(rawText)
      } catch (parseErr) {
        console.error("bank queue: ответ не JSON", response.status, rawText.slice(0, 200))
        throw parseErr
      }

      console.log("RAW bank applications:", JSON.stringify(data, null, 2))

      if (response.ok) {
        const list = Array.isArray(data) ? data : (data.applications || [])
        setApplications(list.map(normalizeBankApplication))
      } else {
        setError((data && data.message) || "Не удалось загрузить заявки")
      }
    } catch (e) {
      console.error("bank queue упал:", e)
      setError("Сервер недоступен. Попробуйте обновить страницу")
    }

    setLoading(false)
  }


  // клик по строке -> карточка заявки сотрудника банка (по global_id!)
  function openApplication(globalId) {
    if (globalId === null || globalId === undefined) return
    navigate("/bank/applications/" + globalId)
  }


  function handleLogout() {
    localStorage.removeItem("token")
    localStorage.removeItem("role")
    localStorage.removeItem("userName")
    navigate("/login")
  }

  const fullName = localStorage.getItem("userName") || "сотрудник"
  const parts = fullName.split(" ")
  const firstName = parts.length >= 2 ? parts[1] : fullName


  return (
    <div className="bank-page">
      <button className="bank-logout" onClick={handleLogout} title="Выйти">
        <span className="material-symbols-outlined">door_open</span>
      </button>

      <div className="bank-body">
        <aside className="bank-sidebar">
          <div className="bank-logo">
            <img src="../../public/assets/alfa-logo-full.svg" className="login-logo" alt="logo" />
          </div>

          <nav className="bank-nav">
            <Link to="/bank" className="bank-nav-item bank-nav-active">
              <span className="material-symbols-outlined">home</span>
              Главная
            </Link>
          </nav>
        </aside>

        <main className="bank-main">
          <header className="bank-header">
            <h1 className="bank-hello">Добрый день, {firstName}</h1>
            <p className="bank-role">{fullName} (сотрудник банка)</p>
          </header>

          <section className="bank-block">
            <h2 className="bank-block-title">Актуальные заявки</h2>

            {loading && <p className="bank-note">Загрузка…</p>}
            {!loading && error !== "" && <p className="bank-note bank-note-error">{error}</p>}

            {!loading && error === "" && applications.length === 0 && (
              <p className="bank-note">Заявок пока нет.</p>
            )}

            {!loading && error === "" && applications.length > 0 && (
              <table className="bank-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>ИНН клиента</th>
                    <th>Риск-балл</th>
                    <th>Сумма</th>
                    <th>Процент</th>
                    <th>Срок</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map(function (app) {
                    const status = STATUS_MAP[app.status] || { label: app.status, cls: "badge-gray" }
                    return (
                      <tr
                        key={app.globalId}
                        className="bank-row"
                        onClick={() => openApplication(app.globalId)}
                      >
                        <td>{formatDate(app.createdAt)}</td>
                        <td>{app.inn}</td>
                        <td className={riskClass(app.riskScore)}>
                          {app.riskScore !== null && app.riskScore !== undefined ? app.riskScore : "—"}
                        </td>
                        <td>{formatMoney(app.amount)}</td>
                        <td>{app.rate !== null && app.rate !== undefined ? app.rate + " %" : "—"}</td>
                        <td>{app.termMonths !== null && app.termMonths !== undefined ? app.termMonths + " мес" : "—"}</td>
                        <td>
                          <span className={"bank-badge " + status.cls}>{status.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        </main>
      </div>
    </div>
  )
}

export default BankDashboard;