const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()

  try {
    switch (action) {
      case 'overview':
        return await getOverview()
      case 'sales':
        return await getSalesStats(data)
      case 'products':
        return await getProductStats(data)
      case 'users':
        return await getUserStats(data)
      case 'daily':
        return await getDailyStats(data)
      case 'order_status_counts':
        return await getOrderStatusCounts(OPENID)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}

async function getOverview() {
  const users = await db.collection('users').count()
  const products = await db.collection('products').where({ status: 1 }).count()
  const orders = await db.collection('orders').count()

  const completedOrders = await db.collection('orders')
    .where({ status: 'completed' })
    .get()

  const totalRevenue = completedOrders.data.reduce((sum, o) => sum + (o.total_amount || 0), 0)

  return {
    code: 0,
    message: '获取成功',
    data: {
      users: users.total,
      products: products.total,
      orders: orders.total,
      totalRevenue
    }
  }
}

async function getSalesStats(data) {
  const { startDate, endDate } = data

  let condition = { status: 'completed' }

  if (startDate && endDate) {
    condition.createdAt = _.gte(new Date(startDate)).and(_.lte(new Date(endDate)))
  }

  const orders = await db.collection('orders')
    .where(condition)
    .get()

  const totalSales = orders.data.reduce((sum, o) => sum + (o.total_amount || 0), 0)
  const totalOrders = orders.data.length

  const categorySales = {}
  orders.data.forEach(order => {
    (order.items || []).forEach(item => {
      const cat = item.category || '其他'
      if (!categorySales[cat]) {
        categorySales[cat] = { amount: 0, count: 0 }
      }
      categorySales[cat].amount += (item.price || 0) * (item.quantity || 0)
      categorySales[cat].count += item.quantity || 0
    })
  })

  return {
    code: 0,
    message: '获取成功',
    data: {
      totalSales,
      totalOrders,
      categorySales: Object.entries(categorySales).map(([name, data]) => ({ name, ...data }))
    }
  }
}

async function getProductStats(data) {
  const { limit = 10 } = data

  const orders = await db.collection('orders')
    .where({ status: 'completed' })
    .get()

  const productSales = {}
  orders.data.forEach(order => {
    (order.items || []).forEach(item => {
      const pid = item.productId || item.product_id || item.id
      if (!pid) return
      if (!productSales[pid]) {
        productSales[pid] = {
          productId: pid,
          name: item.name || '未知商品',
          image: item.image || '',
          sales: 0,
          revenue: 0
        }
      }
      productSales[pid].sales += item.quantity || 0
      productSales[pid].revenue += (item.price || 0) * (item.quantity || 0)
    })
  })

  const sorted = Object.values(productSales)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, limit)

  return { code: 0, message: '获取成功', data: sorted }
}

async function getUserStats(data) {
  const { limit = 10 } = data

  const orders = await db.collection('orders')
    .where({ status: 'completed' })
    .get()

  const userStats = {}
  orders.data.forEach(order => {
    const openid = order.openid
    if (!userStats[openid]) {
      userStats[openid] = { openid, orders: 0, amount: 0 }
    }
    userStats[openid].orders += 1
    userStats[openid].amount += order.total_amount || 0
  })

  const sorted = Object.values(userStats)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)

  return { code: 0, message: '获取成功', data: sorted }
}

async function getDailyStats(data) {
  const { days = 7 } = data

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const orders = await db.collection('orders')
    .where({
      status: 'completed',
      createdAt: _.gte(startDate).and(_.lte(endDate))
    })
    .get()

  const dailyStats = {}
  orders.data.forEach(order => {
    const date = new Date(order.createdAt).toISOString().split('T')[0]
    if (!dailyStats[date]) {
      dailyStats[date] = { date, orders: 0, amount: 0 }
    }
    dailyStats[date].orders += 1
    dailyStats[date].amount += order.total_amount || 0
  })

  const sorted = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date))

  return { code: 0, message: '获取成功', data: sorted }
}

async function getOrderStatusCounts(openid) {
  const statuses = ['pending', 'paid', 'shipped', 'delivering', 'completed', 'cancelled', 'aftersale']
  const counts = {}
  
  for (const status of statuses) {
    const result = await db.collection('orders')
      .where({ openid, status })
      .count()
    counts[status] = result.total
  }

  return { code: 0, message: '获取成功', data: { counts } }
}
