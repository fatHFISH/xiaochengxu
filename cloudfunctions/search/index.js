const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()

  try {
    switch (action) {
      case 'search':
        return await searchProducts(data)
      case 'hot':
        return await getHotSearches()
      case 'history':
        return await getSearchHistory(OPENID)
      case 'clearHistory':
        return await clearSearchHistory(OPENID)
      case 'save':
        return await saveSearchHistory(OPENID, data)
      case 'deleteHistoryItem':
        return await deleteSearchHistoryItem(OPENID, data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}

async function searchProducts(data) {
  const { keyword, categoryId, minPrice, maxPrice, sortBy, sortOrder, page = 1, pageSize = 10 } = data
  
  let condition = { status: 1 }
  
  if (keyword) {
    condition = _.and([
      condition,
      _.or([
        { name: db.RegExp({ regexp: keyword, options: 'i' }) },
        { description: db.RegExp({ regexp: keyword, options: 'i' }) }
      ])
    ])
  }
  
  if (categoryId) {
    condition.categoryId = categoryId
  }
  
  if (minPrice !== undefined) {
    condition.price = _.gte(minPrice)
  }
  
  if (maxPrice !== undefined) {
    condition.price = _.lte(maxPrice)
  }
  
  let orderBy = 'createdAt'
  let orderDirection = 'desc'
  
  if (sortBy === 'price') {
    orderBy = 'price'
    orderDirection = sortOrder || 'asc'
  } else if (sortBy === 'sales') {
    orderBy = 'sales'
    orderDirection = sortOrder || 'desc'
  }
  
  const total = await db.collection('products').where(condition).count()
  
  const products = await db.collection('products')
    .where(condition)
    .orderBy(orderBy, orderDirection)
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    code: 0,
    message: '搜索成功',
    data: {
      list: products.data,
      total: total.total,
      page,
      pageSize,
      totalPages: Math.ceil(total.total / pageSize)
    }
  }
}

async function getHotSearches() {
  const result = await db.collection('searchHistory')
    .aggregate()
    .group({
      _id: '$keyword',
      count: db.command.aggregate.sum(1)
    })
    .sort({ count: -1 })
    .limit(10)
    .end()
  
  return {
    code: 0,
    message: '获取成功',
    data: result.list.map(item => item._id)
  }
}

async function getSearchHistory(openid) {
  const result = await db.collection('searchHistory')
    .where({ openid })
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get()
  
  return {
    code: 0,
    message: '获取成功',
    data: result.data.map(item => item.keyword)
  }
}

async function clearSearchHistory(openid) {
  await db.collection('searchHistory').where({ openid }).remove()
  return { code: 0, message: '清除成功' }
}

async function saveSearchHistory(openid, data) {
  const { keyword } = data
  if (!keyword) return { code: -1, message: '关键词不能为空' }
  
  await db.collection('searchHistory').add({
    data: {
      openid,
      keyword,
      createdAt: db.serverDate()
    }
  })
  
  return { code: 0, message: '保存成功' }
}

async function deleteSearchHistoryItem(openid, data) {
  const { keyword } = data
  if (!keyword) return { code: -1, message: '关键词不能为空' }
  
  await db.collection('searchHistory').where({
    openid,
    keyword
  }).remove()
  
  return { code: 0, message: '删除成功' }
}
