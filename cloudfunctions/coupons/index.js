const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()

  try {
    switch (action) {
      case 'list':
        return await getCoupons(data)
      case 'receive':
        return await receiveCoupon(OPENID, data)
      case 'myCoupons':
        return await getMyCoupons(OPENID, data)
      case 'use':
        return await useCoupon(OPENID, data)
      case 'create':
        return await createCoupon(data)
      case 'update':
        return await updateCoupon(data)
      case 'delete':
        return await deleteCoupon(data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}

async function getCoupons(data) {
  const { status = 'active' } = data
  
  let condition = { status }
  
  const now = new Date()
  condition.startTime = _.lte(now)
  condition.endTime = _.gte(now)
  
  const coupons = await db.collection('coupons')
    .where(condition)
    .orderBy('createdAt', 'desc')
    .get()
  
  return { code: 0, message: '获取成功', data: coupons.data }
}

async function receiveCoupon(openid, data) {
  const { couponId } = data
  
  const coupon = await db.collection('coupons').doc(couponId).get()
  if (!coupon.data) {
    return { code: -1, message: '优惠券不存在' }
  }
  
  if (coupon.data.status !== 'active') {
    return { code: -1, message: '优惠券已失效' }
  }
  
  const now = new Date()
  if (now < coupon.data.startTime || now > coupon.data.endTime) {
    return { code: -1, message: '优惠券不在有效期内' }
  }
  
  if (coupon.data.total <= coupon.data.received) {
    return { code: -1, message: '优惠券已领完' }
  }
  
  const exist = await db.collection('userCoupons')
    .where({ openid, couponId, status: 'unused' })
    .get()
  
  if (exist.data.length > 0 && coupon.data.limitPerUser === 1) {
    return { code: -1, message: '已领取过该优惠券' }
  }
  
  await db.collection('coupons').doc(couponId).update({
    data: { received: _.inc(1) }
  })
  
  await db.collection('userCoupons').add({
    data: {
      openid,
      couponId,
      type: coupon.data.type,
      value: coupon.data.value,
      minAmount: coupon.data.minAmount,
      status: 'unused',
      receivedAt: db.serverDate(),
      expiresAt: coupon.data.endTime
    }
  })
  
  return { code: 0, message: '领取成功' }
}

async function getMyCoupons(openid, data) {
  const { status = 'unused' } = data
  
  const userCoupons = await db.collection('userCoupons')
    .where({ openid, status })
    .orderBy('receivedAt', 'desc')
    .get()
  
  return { code: 0, message: '获取成功', data: userCoupons.data }
}

async function useCoupon(openid, data) {
  const { userCouponId, orderId } = data
  
  const userCoupon = await db.collection('userCoupons').doc(userCouponId).get()
  if (!userCoupon.data) {
    return { code: -1, message: '优惠券不存在' }
  }
  
  if (userCoupon.data.openid !== openid) {
    return { code: -1, message: '无权使用' }
  }
  
  if (userCoupon.data.status !== 'unused') {
    return { code: -1, message: '优惠券已使用或已过期' }
  }
  
  await db.collection('userCoupons').doc(userCouponId).update({
    data: {
      status: 'used',
      usedAt: db.serverDate(),
      orderId
    }
  })
  
  return {
    code: 0,
    message: '使用成功',
    data: {
      type: userCoupon.data.type,
      value: userCoupon.data.value
    }
  }
}

async function createCoupon(data) {
  const { name, type, value, minAmount, total, limitPerUser, startTime, endTime } = data
  
  await db.collection('coupons').add({
    data: {
      name,
      type,
      value,
      minAmount: minAmount || 0,
      total,
      received: 0,
      limitPerUser: limitPerUser || 1,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      status: 'active',
      createdAt: db.serverDate()
    }
  })
  
  return { code: 0, message: '创建成功' }
}

async function updateCoupon(data) {
  const { id, ...updateData } = data
  
  await db.collection('coupons').doc(id).update({
    data: updateData
  })
  
  return { code: 0, message: '更新成功' }
}

async function deleteCoupon(data) {
  const { id } = data
  
  await db.collection('coupons').doc(id).update({
    data: { status: 'deleted' }
  })
  
  return { code: 0, message: '删除成功' }
}
