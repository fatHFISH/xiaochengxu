const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()

  try {
    switch (action) {
      case 'toggle':
        return await toggleFavorite(OPENID, data)
      case 'list':
        return await getFavorites(OPENID, data)
      case 'check':
        return await checkFavorite(OPENID, data)
      case 'remove':
        return await removeFavorite(OPENID, data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}

async function toggleFavorite(openid, data) {
  const { productId } = data
  
  const exist = await db.collection('favorites')
    .where({ openid, productId })
    .get()
  
  if (exist.data.length > 0) {
    await db.collection('favorites').doc(exist.data[0]._id).remove()
    return { code: 0, message: '已取消收藏', data: { isFavorite: false } }
  } else {
    await db.collection('favorites').add({
      data: {
        openid,
        productId,
        createdAt: db.serverDate()
      }
    })
    return { code: 0, message: '收藏成功', data: { isFavorite: true } }
  }
}

async function getFavorites(openid, data) {
  const { page = 1, pageSize = 10 } = data
  
  const total = await db.collection('favorites').where({ openid }).count()
  
  const favorites = await db.collection('favorites')
    .where({ openid })
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  const productIds = favorites.data.map(f => f.productId)
  
  let products = []
  if (productIds.length > 0) {
    const productsRes = await db.collection('products')
      .where({ _id: _.in(productIds) })
      .get()
    products = productsRes.data
  }
  
  return {
    code: 0,
    message: '获取成功',
    data: {
      list: products,
      total: total.total,
      page,
      pageSize
    }
  }
}

async function checkFavorite(openid, data) {
  const { productId } = data
  
  const exist = await db.collection('favorites')
    .where({ openid, productId })
    .get()
  
  return {
    code: 0,
    message: '查询成功',
    data: { isFavorite: exist.data.length > 0 }
  }
}

async function removeFavorite(openid, data) {
  const { productId } = data
  
  await db.collection('favorites')
    .where({ openid, productId })
    .remove()
  
  return { code: 0, message: '取消收藏成功' }
}
