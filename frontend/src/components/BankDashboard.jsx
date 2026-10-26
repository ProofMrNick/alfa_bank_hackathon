
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/BankDashboard.css';
import { STATUS_LABELS } from '../applicationContract.js';


const API_URL = import.meta.env.VITE_LOCAL_API_URL;


function BankDashboard() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('ALL')
  const [risk, setRisk] = useState('ALL')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(loadQueue, 200)
    return () => clearTimeout(timer)
  }, [status, risk, search])

  async function loadQueue() {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ status, risk })
    if (search.trim()) params.set('search', search.trim())
    try {
      const response = await fetch(`${API_URL}/api/bank/applications?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      if (response.status === 401 || response.status === 403) {
        localStorage.clear()
        navigate('/login')
        return
      }
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Не удалось загрузить очередь')
      setItems(data.items || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    localStorage.clear()
    navigate('/login')
  }

  return (
    <div className="bank-page">
      <aside className="bank-sidebar">
        <img src="/assets/alfa-logo-full.svg" alt="Альфа-Банк" />
        <div className="bank-nav-active">Очередь заявок</div>
        <button className="bank-logout" onClick={logout}>Выйти</button>
      </aside>
      <main className="bank-main">
        <header className="bank-header">
          <div><p>Кабинет сотрудника</p><h1>Очередь заявок</h1></div>
          <span className="bank-total">{items.length} заявок</span>
        </header>
        <section className="bank-filters">
          <input aria-label="Поиск" placeholder="Поиск по клиенту, ИНН или номеру" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select aria-label="Статус" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ALL">Все статусы</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select aria-label="Риск" value={risk} onChange={(e) => setRisk(e.target.value)}>
            <option value="ALL">Любой риск</option>
            <option value="LOW">Низкий</option><option value="MEDIUM">Средний</option><option value="HIGH">Высокий</option>
          </select>
        </section>
        {loading && <div className="bank-state">Загрузка…</div>}
        {error && <div className="bank-state bank-error">{error}</div>}
        {!loading && !error && <div className="bank-table-wrap">
          <table className="bank-table">
            <thead><tr><th>Заявка</th><th>Клиент</th><th>Продукт</th><th>Сумма</th><th>Риск</th><th>Статус</th><th></th></tr></thead>
            <tbody>{items.map((item) => <tr key={item.global_id}>
              <td><b>#{item.global_id}</b><small>{new Date(item.time_of_application).toLocaleString('ru-RU')}</small></td>
              <td><b>{item.company_name || item.client_name}</b><small>ИНН {item.inn}</small></td>
              <td>{item.loan_name}</td>
              <td>{Number(item.loan_sum).toLocaleString('ru-RU')} ₽</td>
              <td><span className={`risk risk-${(item.risk_level || 'none').toLowerCase()}`}>{item.risk_level || '—'} {item.risk_score ?? ''}</span></td>
              <td><span className={`bank-status status-${item.status.toLowerCase()}`}>{STATUS_LABELS[item.status] || item.status}</span></td>
              <td><button className="bank-open" onClick={() => navigate(`/bank/application/${item.global_id}`)}>Открыть</button></td>
            </tr>)}</tbody>
          </table>
          {items.length === 0 && <div className="bank-state">По выбранным фильтрам заявок нет</div>}
        </div>}
      </main>
    </div>
  )
}

export default BankDashboard;
