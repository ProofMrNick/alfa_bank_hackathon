
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/SmartSelection.css';


const API_URL = import.meta.env.VITE_LOCAL_API_URL;

// цели кредита. code уходит на бэкенд, label показываем в чипе
const PURPOSES = [
  { code: 'WORKING_CAPITAL', label: 'Пополнение оборотных средств' },
  { code: 'EQUIPMENT', label: 'Закупка оборудования' },
  { code: 'CURRENT_ACTIVITY', label: 'Финансирование текущей деятельности' },
]

// превращаем число шанса одобрения в понятное слово
function probabilityLabel(p) {
  if (p === null || p === undefined) return ''
  if (p >= 0.7) return 'высокий'
  if (p >= 0.4) return 'средний'
  return 'низкий'
}

function formatMoney(value) {
  if (value === null || value === undefined) return '—'
  return Number(value).toLocaleString('ru-RU') + ' ₽'
}

// ---- нормализаторы под реальный ответ бэкенда (snake_case) ----
// имена полей подбора я угадал по стилю каталога из дашборда.
// После первого успешного подбора открой Network, посмотри точные
// имена и поправь пары через ?? здесь, если что-то не совпало.
function normalizeRecommendation(raw) {
  return {
    id: raw.id ?? raw.productId ?? raw.product_id ?? null,
    itemId: raw.itemId ?? raw.item_id ?? raw.recommendationItemId ?? null,
    productName: raw.name ?? raw.productName ?? raw.product_name ?? '',
    description: raw.ai_explanation ?? raw.description ?? raw.purposeLabel ?? '',
    baseRate: raw.interest_rate ?? raw.interestRate ?? raw.baseRate ?? raw.preliminaryRate ?? raw.preliminary_rate ?? null,
    amount: raw.preliminary_limit ?? raw.preliminaryLimit ?? raw.max_amount ?? raw.maxAmount ?? null,
    termMonths: raw.duration ?? raw.termMonths ?? raw.term_months ?? null,
    monthlyPayment:
      raw.monthly_payment ?? raw.monthlyPayment ?? raw.estimated_monthly_payment ?? null,
    overpayment: raw.overpayment ?? raw.total_overpayment ?? raw.totalOverpayment ?? null,
    approvalProbability: raw.approval_probability ?? raw.approvalProbability ?? null,
    reasons: raw.reasons ?? [],
    warnings: raw.warnings ?? [],
    llmUsed: raw.llm_used ?? raw.llmUsed ?? false,
    llmModel: raw.llm_model ?? raw.llmModel ?? '',
  }
}

// ответ создания заявки -> id, на который уходим
function normalizeCreatedApplication(raw) {
  return raw.id ?? raw.application_id ?? raw.applicationId ?? raw.local_id ?? null
}


// ---- карточка одного предложения на экране результата ----
function OfferResultCard(props) {
  const rec = props.rec
  const prob = rec.approvalProbability
  const probWord = probabilityLabel(prob)
  const probPercent = prob !== null && prob !== undefined ? Math.round(prob * 100) + '%' : ''

  return (
    <div className="ss-result-card">
      <div className="ss-result-name">{rec.productName}</div>
      {rec.description ? <div className="ss-result-desc">{rec.description}</div> : null}
      {rec.llmUsed ? (
        <div className="ss-ai-badge">Локальная LLM · {rec.llmModel}</div>
      ) : null}

      <div className="ss-result-params">
        <div className="ss-param">
          <span className="ss-param-label">Ставка</span>
          <span className="ss-param-value">{rec.baseRate != null ? rec.baseRate + '%' : '—'}</span>
        </div>
        <div className="ss-param">
          <span className="ss-param-label">Сумма</span>
          <span className="ss-param-value">{formatMoney(rec.amount)}</span>
        </div>
        <div className="ss-param">
          <span className="ss-param-label">Срок</span>
          <span className="ss-param-value">{rec.termMonths != null ? rec.termMonths + ' мес' : '—'}</span>
        </div>
        {rec.monthlyPayment != null ? (
          <div className="ss-param">
            <span className="ss-param-label">Платёж</span>
            <span className="ss-param-value">{formatMoney(rec.monthlyPayment)}</span>
          </div>
        ) : null}
        {rec.overpayment != null ? (
          <div className="ss-param">
            <span className="ss-param-label">Переплата</span>
            <span className="ss-param-value">{formatMoney(rec.overpayment)}</span>
          </div>
        ) : null}
      </div>

      {/* шанс одобрения и причины — показываем, только если бэкенд прислал */}
      {probWord !== '' ? (
        <div className="ss-prob">
          Шанс одобрения: {probWord}{probPercent ? ' (' + probPercent + ')' : ''}
        </div>
      ) : null}

      {Array.isArray(rec.reasons) && rec.reasons.length > 0 ? (
        <ul className="ss-reasons">
          {rec.reasons.map(function (r, i) { return <li key={i}>+ {r}</li> })}
        </ul>
      ) : null}

      {Array.isArray(rec.warnings) && rec.warnings.length > 0 ? (
        <ul className="ss-warnings">
          {rec.warnings.map(function (w, i) { return <li key={i}>— {w}</li> })}
        </ul>
      ) : null}

      <button
        className="ss-btn-red"
        disabled={props.submitting}
        onClick={() => props.onSubmit(rec)}
      >
        {props.submitting ? 'Отправляем…' : 'Отправить заявку'}
      </button>
    </div>
  )
}


function SmartSelection() {
  const navigate = useNavigate()

  // форма
  const [purpose, setPurpose] = useState('')      // code выбранной цели
  const [amount, setAmount] = useState('')
  const [termMonths, setTermMonths] = useState('')
  const [inn, setInn] = useState('')

  // проверка ИНН (по blur)
  const [checkingInn, setCheckingInn] = useState(false)
  const [companyInfo, setCompanyInfo] = useState(null)   // { name, status, ... }
  const [companyError, setCompanyError] = useState('')

  // экран: 'form' или 'result'
  const [view, setView] = useState('form')
  const [recommendations, setRecommendations] = useState([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submittingId, setSubmittingId] = useState(null) // id карточки, которую сейчас отправляем

  // проверка ИНН по уходу фокуса с поля
  async function handleInnBlur() {
    const value = inn.trim()
    setCompanyInfo(null)
    setCompanyError('')

    if (value === '') return

    setCheckingInn(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(API_URL + '/api/mocks/fns/' + encodeURIComponent(value), {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
      })

      const raw = await response.text()
      let data = null
      try { data = JSON.parse(raw) } catch (e) {
        console.error('fns: ответ не JSON', response.status, raw.slice(0, 200))
        throw e
      }

      if (response.ok && data && (data.name || data.company_name)) {
        setCompanyInfo({
          name: data.name ?? data.company_name ?? '',
          status: data.status ?? '',
          ageMonths: data.ageMonths ?? data.age_months ?? null,
          okved: data.okved_main ?? data.okved ?? '',
        })
      } else {
        setCompanyError('Компания с таким ИНН не найдена')
      }
    } catch (e) {
      console.error('fns упал:', e)
      setCompanyError('Не удалось проверить ИНН')
    }
    setCheckingInn(false)
  }

  // кнопка "Продолжить" -> подбор предложений
  async function handleContinue(event) {
    event.preventDefault()
    setError('')

    const amountNum = Number(amount)
    const termNum = Number(termMonths)

    if (purpose === '') { setError('Выберите цель кредита'); return }
    if (!amountNum || amountNum <= 0) { setError('Укажите сумму кредита'); return }
    if (!termNum || termNum <= 0) { setError('Укажите срок кредита'); return }
    if (inn.trim() === '') { setError('Укажите ИНН'); return }

    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(API_URL + '/api/recommendations/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          purpose: purpose,
          amount: amountNum,
          termMonths: termNum,
          inn: inn.trim(),
        }),
      })

      if (response.status === 401) {
        localStorage.removeItem('token')
        navigate('/login')
        return
      }

      const raw = await response.text()
      let data = null
      try { data = JSON.parse(raw) } catch (e) {
        console.error('recommendations: ответ не JSON', response.status, raw.slice(0, 200))
        throw e
      }

      if (response.ok) {
        const list = (data.recommendations || data.products || []).map(normalizeRecommendation)
        // сортируем по убыванию шанса одобрения (бэкенд должен отдать так же, но подстрахуемся)
        list.sort(function (a, b) {
          const pa = a.approvalProbability == null ? -1 : a.approvalProbability
          const pb = b.approvalProbability == null ? -1 : b.approvalProbability
          return pb - pa
        })
        setRecommendations(list)
        setView('result')
      } else {
        setError(data.message || 'Не удалось получить предложения')
      }
    } catch (e) {
      console.error('recommendations упал:', e)
      setError('Сервер недоступен. Попробуйте ещё раз')
    }

    setLoading(false)
  }

  // кнопка "Отправить заявку" на карточке -> создаём заявку с параметрами из формы
  async function handleSendApplication(rec) {
    setError('')
    setSubmittingId(rec.id)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(API_URL + '/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({
          product_id: rec.id,
          loan_id: rec.id,
          loan_sum: Number(amount),
          loan_duration: Number(termMonths),
          loan_interest: rec.baseRate,
          purpose: purpose,
          inn: inn.trim(),
        }),
      })

      if (response.status === 401) {
        localStorage.removeItem('token')
        navigate('/login')
        return
      }

      const raw = await response.text()
      let data = null
      try { data = JSON.parse(raw) } catch (e) {
        console.error('create application: ответ не JSON', response.status, raw.slice(0, 200))
        throw e
      }

      if (response.ok) {
        const newId = normalizeCreatedApplication(data)
        if (newId != null) {
          navigate('/applications/' + newId)
        } else {
          setError('Заявка создана, но бэкенд не вернул её id')
        }
      } else {
        setError(data.message || 'Не удалось отправить заявку')
      }
    } catch (e) {
      console.error('create application упал:', e)
      setError('Сервер недоступен. Попробуйте ещё раз')
    }

    setSubmittingId(null)
  }

  function handleBackToForm() {
    setError('')
    setView('form')
  }

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  // плашка под полем ИНН
  let innHint = null
  if (checkingInn) {
    innHint = <div className="ss-inn-hint ss-inn-loading">Проверяем ИНН…</div>
  } else if (companyError !== '') {
    innHint = <div className="ss-inn-hint ss-inn-error">{companyError}</div>
  } else if (companyInfo) {
    innHint = (
      <div className="ss-inn-hint ss-inn-ok">
        ✓ {companyInfo.name}{companyInfo.status ? ' · ' + companyInfo.status : ''}
      </div>
    )
  }

  return (
    <div className="ss-page">
      <button className="ss-logout" onClick={handleLogout} title="Выйти">
        <span className="material-symbols-outlined">door_open</span>
      </button>

      <div className="ss-body">
        <aside className="ss-sidebar">
          <div className="ss-logo">
            <img src="../../public/assets/alfa-logo-full.svg" className="ss-logo-img" alt="logo" />
          </div>
          <nav className="ss-nav">
            <button className="ss-nav-item" onClick={() => navigate('/')}>
              <span className="material-symbols-outlined">home</span>
              Главная
            </button>
            <button className="ss-nav-item ss-nav-active">
              <span className="material-symbols-outlined">savings</span>
              Подобрать финансирование
            </button>
          </nav>
        </aside>

        <main className="ss-main">
          {view === 'form' && (
            <div className="ss-form-wrap">
              <div className="ss-form-card">
                <h1 className="ss-title">
                  Заполните заявку,
                  <br />
                  и получите кредитные предложения
                </h1>

                <form onSubmit={handleContinue}>
                  <p className="ss-field-label">Какова цель кредита?</p>
                  <div className="ss-purposes">
                    {PURPOSES.map(function (p) {
                      const active = purpose === p.code
                      return (
                        <button
                          type="button"
                          key={p.code}
                          className={'ss-chip' + (active ? ' ss-chip-active' : '')}
                          onClick={() => setPurpose(p.code)}
                        >
                          {p.label}
                        </button>
                      )
                    })}
                  </div>

                  <div className="ss-row">
                    <input
                      className="ss-input"
                      type="number"
                      min="0"
                      placeholder="Сумма кредита"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <input
                      className="ss-input"
                      type="number"
                      min="0"
                      placeholder="Срок кредита, мес"
                      value={termMonths}
                      onChange={(e) => setTermMonths(e.target.value)}
                    />
                  </div>
                  <p className="ss-note">Укажите желаемую сумму кредита и срок кредита в месяцах</p>

                  <input
                    className="ss-input ss-input-full"
                    type="text"
                    placeholder="ИНН"
                    value={inn}
                    onChange={(e) => setInn(e.target.value)}
                    onBlur={handleInnBlur}
                  />
                  {innHint}

                  {error !== '' && <p className="ss-error">{error}</p>}

                  <div className="ss-form-footer">
                    <p className="ss-consent">
                      Нажимая кнопку «Продолжить», вы подтверждаете,
                      <br />
                      что согласны на обработку персональных данных
                    </p>
                    <button className="ss-btn-red" type="submit" disabled={loading}>
                      {loading ? 'Подбираем…' : 'Продолжить'}
                    </button>
                  </div>
                </form>
              </div>

              {/* 3D-картинка справа, путь подставишь сам */}
              <img src="#" className="ss-hero-img" alt="" />
            </div>
          )}

          {/* ---------- ЭКРАН РЕЗУЛЬТАТОВ ---------- */}
          {view === 'result' && (
            <div className="ss-result-wrap">
              <button className="ss-back-pill" onClick={handleBackToForm}>
                ← Изменить параметры
              </button>

              <div className="ss-result-card-outer">
                <h1 className="ss-title ss-title-result">Кредитные предложения</h1>

                {companyInfo ? (
                  <p className="ss-company-line">
                    Для компании: {companyInfo.name}
                    {companyInfo.status ? ' · ' + companyInfo.status : ''}
                    {companyInfo.ageMonths != null ? ' · ' + companyInfo.ageMonths + ' мес' : ''}
                    {companyInfo.okved ? ' · ОКВЭД ' + companyInfo.okved : ''}
                  </p>
                ) : null}

                {error !== '' && <p className="ss-error">{error}</p>}

                {recommendations.length === 0 ? (
                  <p className="ss-empty">
                    Подходящих предложений не нашлось. Измените параметры или свяжитесь с менеджером.
                  </p>
                ) : (
                  <div className="ss-result-list">
                    {recommendations.map(function (rec) {
                      return (
                        <OfferResultCard
                          key={rec.id}
                          rec={rec}
                          submitting={submittingId === rec.id}
                          onSubmit={handleSendApplication}
                        />
                      )
                    })}
                  </div>
                )}

                <p className="ss-disclaimer">
                  Предложения предварительные и не являются решением банка.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default SmartSelection
