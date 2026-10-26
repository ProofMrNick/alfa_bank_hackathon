
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/BankApplicationDetails.css';
import { STATUS_LABELS } from '../applicationContract.js';


const API_URL = import.meta.env.VITE_LOCAL_API_URL;


function BankApplicationDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [decision, setDecision] = useState({ type: 'APPROVE', approvedAmount: '', approvedTermMonths: '', approvedRate: '', missingFields: '', reason: '', comment: '' })

  useEffect(() => { load() }, [id])

  async function request(path, options = {}) {
    const response = await fetch(`${API_URL}/api/bank${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}`, ...(options.headers || {}) },
    })
    if (response.status === 401 || response.status === 403) { localStorage.clear(); navigate('/login'); return null }
    const result = await response.json()
    if (!response.ok) throw new Error(result.message || 'Ошибка запроса')
    return result
  }

  async function load() {
    setLoading(true); setError('')
    try {
      const result = await request(`/applications/${id}`)
      if (!result) return
      setData(result)
      const app = result.application
      setDecision((value) => ({ ...value, approvedAmount: app.loan_sum || '', approvedTermMonths: app.loan_duration || '', approvedRate: app.loan_interest || '' }))
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  async function submitDecision(event) {
    event.preventDefault(); setBusy(true); setError('')
    const payload = { type: decision.type, comment: decision.comment }
    if (decision.type === 'APPROVE' || decision.type === 'COUNTEROFFER') {
      payload.approvedAmount = Number(decision.approvedAmount)
      payload.approvedTermMonths = Number(decision.approvedTermMonths)
      payload.approvedRate = Number(decision.approvedRate)
    } else if (decision.type === 'REQUEST_INFO') {
      payload.missingFields = decision.missingFields.split(',').map((item) => item.trim()).filter(Boolean)
    } else payload.reason = decision.reason
    try {
      await request(`/applications/${id}/decision`, { method: 'POST', body: JSON.stringify(payload) })
      await load()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  async function rescore() {
    setBusy(true); setError('')
    try { await request(`/applications/${id}/rescore`, { method: 'POST' }); await load() }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  if (loading) return <div className="detail-state">Загрузка…</div>
  if (!data) return <div className="detail-state detail-error">{error || 'Заявка не найдена'}</div>
  const { application: app, client, enrichment, scoring, history } = data
  const factors = scoring?.factors || []

  return (
    <div className="detail-page">
      <header className="detail-top"><button onClick={() => navigate('/bank')}>← Очередь</button><div><small>Заявка #{app.global_id}</small><h1>{client.company_name}</h1></div><span className="detail-status">{STATUS_LABELS[app.status] || app.status}</span></header>
      {error && <div className="detail-alert">{error}</div>}
      <div className="detail-grid">
        <main>
          <section className="detail-card"><h2>Клиент и заявка</h2><div className="detail-fields">
            <Field label="Клиент" value={client.name} /><Field label="ИНН" value={client.inn} /><Field label="Email" value={client.email} />
            <Field label="Продукт" value={app.loan_name} /><Field label="Сумма" value={`${Number(app.loan_sum).toLocaleString('ru-RU')} ₽`} /><Field label="Срок" value={`${app.loan_duration} мес.`} />
          </div></section>
          <section className="detail-card"><h2>Факторы риска</h2>
            <div className="score-line"><strong>{scoring?.score ?? '—'}</strong><span>Риск: {scoring?.risk_level || 'не рассчитан'}<br />PD: {scoring?.default_probability == null ? '—' : `${Math.round(scoring.default_probability * 100)}%`}</span></div>
            <div className="factor-list">{factors.length ? factors.map((factor, index) => <div className={`factor factor-${(factor.impact || 'neutral').toLowerCase()}`} key={factor.code || index}><b>{factor.message || factor.code}</b><span>{factor.points ? `${factor.points > 0 ? '+' : ''}${factor.points}` : factor.value ?? ''}</span></div>) : <p>Факторы пока отсутствуют</p>}</div>
          </section>
          <section className="detail-card"><h2>Данные источников</h2><div className="source-grid">
            <Source title="ФНС" source={enrichment.fns} /><Source title="БКИ" source={enrichment.bki} /><Source title="Банк" source={enrichment.internal} />
          </div></section>
          <section className="detail-card"><h2>История</h2><div className="timeline">{history.map((event) => <div key={event.id}><time>{new Date(event.timestamp).toLocaleString('ru-RU')}</time><b>{STATUS_LABELS[event.new_status] || event.new_status}</b><span>{event.comment}</span></div>)}</div></section>
        </main>
        <aside>
          <form className="decision-card" onSubmit={submitDecision}><h2>Решение</h2>
            <label>Действие<select value={decision.type} onChange={(e) => setDecision({ ...decision, type: e.target.value })}><option value="APPROVE">Одобрить</option><option value="COUNTEROFFER">Контрпредложение</option><option value="REQUEST_INFO">Запросить данные</option><option value="DECLINE">Отказать</option></select></label>
            {(decision.type === 'APPROVE' || decision.type === 'COUNTEROFFER') && <><label>Сумма<input type="number" value={decision.approvedAmount} onChange={(e) => setDecision({ ...decision, approvedAmount: e.target.value })} required /></label><label>Срок, мес.<input type="number" value={decision.approvedTermMonths} onChange={(e) => setDecision({ ...decision, approvedTermMonths: e.target.value })} required /></label><label>Ставка, %<input type="number" step="0.1" value={decision.approvedRate} onChange={(e) => setDecision({ ...decision, approvedRate: e.target.value })} required /></label></>}
            {decision.type === 'REQUEST_INFO' && <label>Недостающие поля<input value={decision.missingFields} placeholder="monthly_payment, total_debt" onChange={(e) => setDecision({ ...decision, missingFields: e.target.value })} required /></label>}
            {decision.type === 'DECLINE' && <label>Причина<input value={decision.reason} onChange={(e) => setDecision({ ...decision, reason: e.target.value })} required /></label>}
            <label>Комментарий<textarea value={decision.comment} onChange={(e) => setDecision({ ...decision, comment: e.target.value })} /></label>
            <button className="decision-primary" disabled={busy}>{busy ? 'Сохраняем…' : 'Применить решение'}</button>
            <button type="button" className="decision-secondary" disabled={busy} onClick={rescore}>Повторить scoring</button>
          </form>
        </aside>
      </div>
    </div>
  )
}

function Field({ label, value }) { return <div><span>{label}</span><b>{value || '—'}</b></div> }
function Source({ title, source }) { return <div><h3>{title}</h3>{source ? Object.entries(source).slice(0, 7).map(([key, value]) => <p key={key}><span>{key}</span><b>{value == null ? '—' : String(value)}</b></p>) : <p>Нет данных</p>}</div> }

export default BankApplicationDetails;
