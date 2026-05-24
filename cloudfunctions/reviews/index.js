const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()

  try {
    switch (action) {
      case 'create':
        return await createReview(OPENID, data)
      case 'list':
        return await getReviews(data)
      case 'userReviews':
        return await getUserReviews(OPENID, data)
      case 'like':
        return await likeReview(OPENID, data)
      case 'reply':
        return await replyReview(data)
      case 'delete':
        return await deleteReview(OPENID, data)
      case 'report':
        return await reportReview(OPENID, data)
      case 'stats':
        return await getReviewStats(data)
      case 'tags':
        return await getReviewTags(data)
      case 'recalcRating':
        return await recalcProductRating(data)
      case 'recalcAll':
        return await recalcAllProductRatings()
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}

async function createReview(openid, data) {
  const { orderId, productId, rating, content, images = [], tags = [] } = data
  
  if (!rating || rating < 1 || rating > 5) {
    return { code: -1, message: '评分必须在1-5之间' }
  }
  
  if (!content && images.length === 0) {
    return { code: -1, message: '评价内容或图片不能为空' }
  }
  
  const order = await db.collection('orders').doc(orderId).get()
  if (!order.data || order.data.openid !== openid) {
    return { code: -1, message: '订单不存在或无权评价' }
  }
  
  if (order.data.status !== 'completed') {
    return { code: -1, message: '只能评价已完成的订单' }
  }
  
  const exist = await db.collection('reviews')
    .where({ orderId, openid })
    .get()
  
  if (exist.data.length > 0) {
    return { code: -1, message: '该订单已评价' }
  }
  
  const result = await db.collection('reviews').add({
    data: {
      openid,
      orderId,
      productId,
      rating,
      content,
      images,
      tags,
      likes: 0,
      likedBy: [],
      reply: null,
      reported: false,
      reportCount: 0,
      createdAt: db.serverDate()
    }
  })
  
  await db.collection('orders').doc(orderId).update({
    data: { reviewed: true }
  })
  
  await updateProductAvgRating(productId)
  
  return { code: 0, message: '评价成功', data: { id: result._id } }
}

async function getReviews(data) {
  const { productId, page = 1, pageSize = 10, sortBy = 'createdAt', rating, hasImages } = data
  
  let condition = { reported: false }
  if (productId) {
    condition.productId = productId
  }
  if (rating) {
    condition.rating = rating
  }
  if (hasImages) {
    condition.images = _.neq([])
  }
  
  const total = await db.collection('reviews').where(condition).count()
  
  const reviews = await db.collection('reviews')
    .where(condition)
    .orderBy(sortBy, 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  const userOpenids = reviews.data.map(r => r.openid)
  let users = {}
  
  if (userOpenids.length > 0) {
    const usersRes = await db.collection('users')
      .where({ openid: _.in(userOpenids) })
      .get()
    usersRes.data.forEach(u => { users[u.openid] = u })
  }
  
  const list = reviews.data.map(r => ({
    ...r,
    user: users[r.openid] || { nickname: '匿名用户', avatar: '' }
  }))
  
  return {
    code: 0,
    message: '获取成功',
    data: { list, total: total.total, page, pageSize }
  }
}

async function getUserReviews(openid, data) {
  const { page = 1, pageSize = 10 } = data
  
  const total = await db.collection('reviews').where({ openid }).count()
  
  const reviews = await db.collection('reviews')
    .where({ openid })
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    code: 0,
    message: '获取成功',
    data: { list: reviews.data, total: total.total, page, pageSize }
  }
}

async function likeReview(openid, data) {
  const { reviewId } = data
  
  const review = await db.collection('reviews').doc(reviewId).get()
  if (!review.data) {
    return { code: -1, message: '评价不存在' }
  }
  
  const likedBy = review.data.likedBy || []
  
  if (likedBy.includes(openid)) {
    await db.collection('reviews').doc(reviewId).update({
      data: {
        likes: _.inc(-1),
        likedBy: _.pull(openid)
      }
    })
    return { code: 0, message: '已取消点赞', data: { liked: false } }
  } else {
    await db.collection('reviews').doc(reviewId).update({
      data: {
        likes: _.inc(1),
        likedBy: _.push(openid)
      }
    })
    return { code: 0, message: '点赞成功', data: { liked: true } }
  }
}

async function replyReview(data) {
  const { reviewId, content } = data
  
  if (!content) {
    return { code: -1, message: '回复内容不能为空' }
  }
  
  const review = await db.collection('reviews').doc(reviewId).get()
  if (!review.data) {
    return { code: -1, message: '评价不存在' }
  }
  
  await db.collection('reviews').doc(reviewId).update({
    data: {
      reply: {
        content,
        createdAt: db.serverDate()
      }
    }
  })
  
  return { code: 0, message: '回复成功' }
}

async function deleteReview(openid, data) {
  const { reviewId } = data
  
  const review = await db.collection('reviews').doc(reviewId).get()
  if (!review.data) {
    return { code: -1, message: '评价不存在' }
  }
  
  if (review.data.openid !== openid) {
    return { code: -1, message: '无权删除' }
  }
  
  await db.collection('reviews').doc(reviewId).remove()
  
  await updateProductAvgRating(review.data.productId)
  
  return { code: 0, message: '删除成功' }
}

async function reportReview(openid, data) {
  const { reviewId, reason } = data
  
  if (!reason) {
    return { code: -1, message: '举报原因不能为空' }
  }
  
  const review = await db.collection('reviews').doc(reviewId).get()
  if (!review.data) {
    return { code: -1, message: '评价不存在' }
  }
  
  if (review.data.openid === openid) {
    return { code: -1, message: '不能举报自己的评价' }
  }
  
  const existReport = await db.collection('reviewReports')
    .where({ reviewId, openid })
    .get()
  
  if (existReport.data.length > 0) {
    return { code: -1, message: '已举报过该评价' }
  }
  
  await db.collection('reviewReports').add({
    data: {
      reviewId,
      openid,
      reason,
      createdAt: db.serverDate()
    }
  })
  
  await db.collection('reviews').doc(reviewId).update({
    data: {
      reportCount: _.inc(1)
    }
  })
  
  const updatedReview = await db.collection('reviews').doc(reviewId).get()
  if (updatedReview.data.reportCount >= 5) {
    await db.collection('reviews').doc(reviewId).update({
      data: { reported: true }
    })
  }
  
  return { code: 0, message: '举报成功，我们会尽快处理' }
}

async function getReviewStats(data) {
  const { productId } = data
  
  if (!productId) {
    return { code: -1, message: '商品ID不能为空' }
  }
  
  const reviews = await db.collection('reviews')
    .where({ productId, reported: false })
    .get()
  
  if (reviews.data.length === 0) {
    return {
      code: 0,
      message: '获取成功',
      data: {
        total: 0,
        averageRating: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        withImages: 0
      }
    }
  }
  
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  let totalRating = 0
  let withImages = 0
  
  reviews.data.forEach(r => {
    distribution[r.rating] = (distribution[r.rating] || 0) + 1
    totalRating += r.rating
    if (r.images && r.images.length > 0) {
      withImages++
    }
  })
  
  return {
    code: 0,
    message: '获取成功',
    data: {
      total: reviews.data.length,
      averageRating: parseFloat((totalRating / reviews.data.length).toFixed(1)),
      ratingDistribution: distribution,
      withImages
    }
  }
}

async function updateProductAvgRating(productId) {
  if (!productId) return
  
  const reviews = await db.collection('reviews')
    .where({ productId, reported: false })
    .get()
  
  const total = reviews.data.length
  let avgRating = 0
  if (total > 0) {
    const sum = reviews.data.reduce((s, r) => s + r.rating, 0)
    avgRating = parseFloat((sum / total).toFixed(1))
  }
  
  await db.collection('products').doc(productId).update({
    data: {
      avgRating,
      reviewCount: total,
      updatedAt: db.serverDate()
    }
  })
}

async function recalcProductRating(data) {
  const { productId } = data
  if (!productId) {
    return { code: -1, message: '商品ID不能为空' }
  }
  
  await updateProductAvgRating(productId)
  
  const product = await db.collection('products').doc(productId).get()
  return {
    code: 0,
    message: '评分重算成功',
    data: {
      productId,
      avgRating: product.data.avgRating || 0,
      reviewCount: product.data.reviewCount || 0
    }
  }
}

async function recalcAllProductRatings() {
  const products = await db.collection('products').get()
  let count = 0
  
  for (const product of products.data) {
    await updateProductAvgRating(product._id)
    count++
  }
  
  return {
    code: 0,
    message: `已重算 ${count} 个商品的评分`
  }
}

async function getReviewTags(data) {
  const { productId } = data
  
  if (!productId) {
    return { code: -1, message: '商品ID不能为空' }
  }
  
  const reviews = await db.collection('reviews')
    .where({ productId, reported: false })
    .get()
  
  const tagCount = {}
  reviews.data.forEach(r => {
    if (r.tags && Array.isArray(r.tags)) {
      r.tags.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1
      })
    }
  })
  
  const tags = Object.entries(tagCount)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
  
  return {
    code: 0,
    message: '获取成功',
    data: tags
  }
}
