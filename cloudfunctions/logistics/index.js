const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()

  try {
    switch (action) {
      case 'query':
        return await queryLogistics(data)
      case 'update':
        return await updateLogistics(data)
      case 'list':
        return await getLogisticsList(data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}

async function queryLogistics(data) {
  const { orderId } = data
  
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) {
    return { code: -1, message: '订单不存在' }
  }
  
  if (!order.data.logistics) {
    return { code: -1, message: '暂无物流信息' }
  }
  
  return {
    code: 0,
    message: '获取成功',
    data: {
      company: order.data.logistics.company,
      number: order.data.logistics.number,
      status: order.data.logistics.status,
      traces: order.data.logistics.traces || []
    }
  }
}

async function updateLogistics(data) {
  const { orderId, company, number, status, trace } = data
  
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data) {
    return { code: -1, message: '订单不存在' }
  }
  
  const logistics = order.data.logistics || { traces: [] }
  
  if (company) logistics.company = company
  if (number) logistics.number = number
  if (status) logistics.status = status
  
  if (trace) {
    logistics.traces = logistics.traces || []
    logistics.traces.push({
      ...trace,
      time: trace.time || new Date().toISOString()
    })
  }
  
  await db.collection('orders').doc(orderId).update({
    data: { logistics }
  })
  
  return { code: 0, message: '更新成功', data: logistics }
}

async function getLogisticsList(data) {
  const { status, page = 1, pageSize = 10 } = data
  
  let condition = {}
  if (status) {
    condition['logistics.status'] = status
  }
  
  const total = await db.collection('orders')
    .where(condition)
    .count()
  
  const orders = await db.collection('orders')
    .where(condition)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  const list = orders.data
    .filter(o => o.logistics)
    .map(o => ({
      orderId: o._id,
      company: o.logistics.company,
      number: o.logistics.number,
      status: o.logistics.status,
      updatedAt: o.logistics.updatedAt || o.createdAt
    }))
  
  return {
    code: 0,
    message: '获取成功',
    data: { list, total: total.total, page, pageSize }
  }
}
