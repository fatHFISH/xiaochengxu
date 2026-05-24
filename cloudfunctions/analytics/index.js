const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()

  try {
    switch (action) {
      case 'track':
        return await trackEvent(OPENID, data)
      case 'userActivity':
        return await getUserActivity(OPENID, data)
      case 'productViews':
        return await getProductViews(data)
      case 'popularProducts':
        return await getPopularProducts(data)
      case 'searchTrends':
        return await getSearchTrends(data)
      case 'userRetention':
        return await getUserRetention(data)
      case 'funnel':
        return await getConversionFunnel(data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}

async function trackEvent(openid, data) {
  const { eventType, eventData = {} } = data
  
  if (!eventType) {
    return { code: -1, message: '事件类型不能为空' }
  }
  
  await db.collection('userEvents').add({
    data: {
      openid,
      eventType,
      eventData,
      createdAt: db.serverDate()
    }
  })
  
  return { code: 0, message: '记录成功' }
}

async function getUserActivity(openid, data) {
  const { days = 7 } = data
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  const events = await db.collection('userEvents')
    .where({
      openid,
      createdAt: _.gte(startDate)
    })
    .orderBy('createdAt', 'desc')
    .get()
  
  const eventTypeCount = {}
  events.data.forEach(e => {
    eventTypeCount[e.eventType] = (eventTypeCount[e.eventType] || 0) + 1
  })
  
  return {
    code: 0,
    message: '获取成功',
    data: {
      events: events.data,
      eventTypeCount,
      totalEvents: events.data.length
    }
  }
}

async function getProductViews(data) {
  const { productId, days = 7 } = data
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  const condition = {
    eventType: 'product_view',
    createdAt: _.gte(startDate)
  }
  
  if (productId) {
    condition['eventData.productId'] = productId
  }
  
  const views = await db.collection('userEvents')
    .where(condition)
    .get()
  
  const uniqueUsers = [...new Set(views.data.map(v => v.openid))]
  
  return {
    code: 0,
    message: '获取成功',
    data: {
      totalViews: views.data.length,
      uniqueUsers: uniqueUsers.length,
      views
    }
  }
}

async function getPopularProducts(data) {
  const { limit = 10, days = 7 } = data
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  const views = await db.collection('userEvents')
    .where({
      eventType: 'product_view',
      createdAt: _.gte(startDate)
    })
    .get()
  
  const productViews = {}
  views.data.forEach(v => {
    const productId = v.eventData.productId
    if (productId) {
      if (!productViews[productId]) {
        productViews[productId] = { productId, views: 0, users: new Set() }
      }
      productViews[productId].views++
      productViews[productId].users.add(v.openid)
    }
  })
  
  const sorted = Object.values(productViews)
    .map(p => ({ ...p, uniqueUsers: p.users.size }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit)
  
  const productIds = sorted.map(p => p.productId)
  let products = {}
  
  if (productIds.length > 0) {
    const productsRes = await db.collection('products')
      .where({ _id: _.in(productIds) })
      .get()
    productsRes.data.forEach(p => { products[p._id] = p })
  }
  
  const result = sorted.map(s => ({
    ...s,
    product: products[s.productId] || null
  }))
  
  return { code: 0, message: '获取成功', data: result }
}

async function getSearchTrends(data) {
  const { limit = 10, days = 7 } = data
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  const searches = await db.collection('userEvents')
    .where({
      eventType: 'search',
      createdAt: _.gte(startDate)
    })
    .get()
  
  const keywordCount = {}
  searches.data.forEach(s => {
    const keyword = s.eventData.keyword
    if (keyword) {
      keywordCount[keyword] = (keywordCount[keyword] || 0) + 1
    }
  })
  
  const sorted = Object.entries(keywordCount)
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
  
  return { code: 0, message: '获取成功', data: sorted }
}

async function getUserRetention(data) {
  const { days = 30 } = data
  
  const now = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  const users = await db.collection('users').get()
  
  const activeUsers = await db.collection('userEvents')
    .aggregate()
    .match({
      createdAt: _.gte(startDate)
    })
    .group({
      _id: '$openid',
      lastActive: db.command.aggregate.max('$createdAt')
    })
    .end()
  
  const activeUserIds = new Set(activeUsers.list.map(u => u._id))
  
  const newUsers = await db.collection('users')
    .where({
      createdAt: _.gte(startDate)
    })
    .get()
  
  const newUserIdSet = new Set(newUsers.data.map(u => u.openid))
  
  let retainedNewUsers = 0
  newUsers.data.forEach(u => {
    if (activeUserIds.has(u.openid)) {
      retainedNewUsers++
    }
  })
  
  return {
    code: 0,
    message: '获取成功',
    data: {
      totalUsers: users.data.length,
      activeUsers: activeUsers.list.length,
      newUsers: newUsers.data.length,
      retainedNewUsers,
      retentionRate: newUsers.data.length > 0 
        ? parseFloat((retainedNewUsers / newUsers.data.length * 100).toFixed(2))
        : 0,
      activeRate: users.data.length > 0
        ? parseFloat((activeUsers.list.length / users.data.length * 100).toFixed(2))
        : 0
    }
  }
}

async function getConversionFunnel(data) {
  const { days = 7 } = data
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  const events = await db.collection('userEvents')
    .where({
      createdAt: _.gte(startDate)
    })
    .get()
  
  const funnel = {
    product_view: 0,
    add_to_cart: 0,
    create_order: 0,
    pay_order: 0
  }
  
  events.data.forEach(e => {
    if (funnel.hasOwnProperty(e.eventType)) {
      funnel[e.eventType]++
    }
  })
  
  const uniqueFunnel = {
    product_view: new Set(),
    add_to_cart: new Set(),
    create_order: new Set(),
    pay_order: new Set()
  }
  
  events.data.forEach(e => {
    if (uniqueFunnel.hasOwnProperty(e.eventType)) {
      uniqueFunnel[e.eventType].add(e.openid)
    }
  })
  
  const viewCount = funnel.product_view
  const cartCount = funnel.add_to_cart
  const orderCount = funnel.create_order
  const payCount = funnel.pay_order
  
  return {
    code: 0,
    message: '获取成功',
    data: {
      total: funnel,
      unique: {
        product_view: uniqueFunnel.product_view.size,
        add_to_cart: uniqueFunnel.add_to_cart.size,
        create_order: uniqueFunnel.create_order.size,
        pay_order: uniqueFunnel.pay_order.size
      },
      conversionRates: {
        viewToCart: viewCount > 0 ? parseFloat((cartCount / viewCount * 100).toFixed(2)) : 0,
        cartToOrder: cartCount > 0 ? parseFloat((orderCount / cartCount * 100).toFixed(2)) : 0,
        orderToPay: orderCount > 0 ? parseFloat((payCount / orderCount * 100).toFixed(2)) : 0,
        viewToPay: viewCount > 0 ? parseFloat((payCount / viewCount * 100).toFixed(2)) : 0
      }
    }
  }
}
