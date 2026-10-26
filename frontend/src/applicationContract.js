export const APPLICATION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  ENRICHMENT: 'ENRICHMENT',
  SCORING: 'SCORING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  NEED_MORE_INFO: 'NEED_MORE_INFO',
  APPROVED: 'APPROVED',
  COUNTEROFFER: 'COUNTEROFFER',
  DECLINED: 'DECLINED',
  ACCEPTED: 'ACCEPTED',
  CANCELLED: 'CANCELLED',
})

export const STATUS_LABELS = Object.freeze({
  DRAFT: 'Черновик',
  SUBMITTED: 'Отправлена',
  ENRICHMENT: 'Проверка данных',
  SCORING: 'Скоринг',
  UNDER_REVIEW: 'На рассмотрении',
  NEED_MORE_INFO: 'Нужны данные',
  APPROVED: 'Одобрена',
  COUNTEROFFER: 'Контрпредложение',
  DECLINED: 'Отказ',
  ACCEPTED: 'Принята клиентом',
  CANCELLED: 'Отклонена клиентом',
})

export const DECISION_TYPES = Object.freeze(['APPROVE', 'COUNTEROFFER', 'REQUEST_INFO', 'DECLINE'])
