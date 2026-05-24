const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const products = db.collection('products')

async function deductStock(items) {
  const products = db.collection('products')
  for (const item of items) {
    const product = await products.doc(item.productId || item.id).get()
    if (!product.data) {
      throw new Error(`商品 ${item.name || item.productId} 不存在`)
    }
    if ((product.data.stock || 0) < item.quantity) {
      throw new Error(`商品 ${product.data.name} 库存不足（剩余${product.data.stock}）`)
    }
    await products.doc(item.productId || item.id).update({
      data: { stock: _.inc(-item.quantity) }
    })
  }
}

async function restoreStock(items) {
  const products = db.collection('products')
  for (const item of items) {
    await products.doc(item.productId || item.id).update({
      data: { stock: _.inc(item.quantity) }
    })
  }
}

async function increaseSales(items) {
  const products = db.collection('products')
  for (const item of items) {
    await products.doc(item.productId || item.id).update({
      data: { sales: _.inc(item.quantity) }
    })
  }
}

const STATUS_MAP = {
  pending: '待支付',
  paid: '已支付',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消'
}

async function sendOrderStatusNotification(openid, orderNo, status, remark) {
  try {
    const notifications = db.collection('notifications')
    await notifications.add({
      data: {
        openid,
        type: 'order_status',
        title: '订单状态更新',
        content: `订单 ${orderNo} 状态已更新为：${STATUS_MAP[status] || status}`,
        orderNo,
        status,
        remark: remark || '',
        read: false,
        createdAt: db.serverDate()
      }
    })
    
    try {
      await cloud.openapi.subscribeMessage.send({
        touser: openid,
        templateId: '', 
        page: '/pages/index/index?tab=order&orderNo=' + orderNo,
        data: {
          thing1: { value: '订单状态更新' },
          thing2: { value: `订单 ${orderNo.slice(-8)} 已${STATUS_MAP[status] || status}` },
          thing3: { value: remark || STATUS_MAP[status] || status }
        }
      })
    } catch (subErr) {
      console.log('发送订阅消息失败（可忽略）:', subErr.message)
    }
  } catch (e) {
    console.error('保存通知失败:', e.message)
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action, data = {} } = event
  const orders = db.collection('orders')

  try {
    if (event.type === 'timer') {
      const timeout = 30
      const expireTime = new Date(Date.now() - timeout * 60 * 1000)
      const expiredOrders = await orders.where({
        status: 'pending',
        createdAt: _.lte(expireTime)
      }).get()

      let restored = 0
      for (const order of expiredOrders.data) {
        try {
          await restoreStock(order.items)
          await orders.doc(order._id).update({
            data: { status: 'cancelled', cancel_reason: '超时未支付', updatedAt: db.serverDate() }
          })
          await sendOrderStatusNotification(order.openid, order.order_no, 'cancelled', '订单超时未支付，已自动取消')
          restored++
        } catch (e) {
          console.error('归还库存失败:', order._id, e.message)
        }
      }
      return { code: 0, message: `定时触发：已处理 ${restored} 个超时订单` }
    }

    if (action === 'list') {
      const { page = 1, page_size = 20, status } = data
      let query = { openid }
      if (status) query.status = status

      const result = await orders
        .where(query)
        .orderBy('createdAt', 'desc')
        .skip((page - 1) * page_size)
        .limit(page_size)
        .get()

      const countResult = await orders.where(query).count()
      return { code: 0, data: { list: result.data, total: countResult.total } }
    }

    if (action === 'detail') {
      const result = await orders.doc(data.id).get()
      if (!result.data) {
        return { code: -1, message: '订单不存在' }
      }
      if (result.data.openid !== openid) {
        return { code: -1, message: '无权查看此订单' }
      }
      return { code: 0, data: result.data }
    }

    if (action === 'create') {
      if (!data.items || data.items.length === 0) {
        return { code: -1, message: '订单商品不能为空' }
      }
      if (!data.address) {
        return { code: -1, message: '收货地址不能为空' }
      }
      if (!data.total_amount || data.total_amount <= 0) {
        return { code: -1, message: '订单金额不正确' }
      }

      await deductStock(data.items)

      const enrichedItems = []
      for (const item of data.items) {
        const product = await products.doc(item.productId || item.id).get()
        if (product.data) {
          enrichedItems.push({
            productId: product.data._id,
            name: product.data.name,
            image: product.data.image || product.data.images?.[0] || '',
            price: product.data.price,
            original_price: product.data.original_price || product.data.price,
            quantity: item.quantity,
            category: product.data.category || ''
          })
        } else {
          enrichedItems.push(item)
        }
      }

      const orderNo = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase()
      const addResult = await orders.add({
        data: {
          openid,
          order_no: orderNo,
          status: 'pending',
          items: enrichedItems,
          address: data.address,
          total_amount: data.total_amount,
          pay_amount: data.pay_amount || data.total_amount,
          coupon_id: data.coupon_id || null,
          discount_amount: data.discount_amount || 0,
          remark: data.remark || '',
          paid: false,
          paidAt: null,
          reviewed: false,
          logistics: null,
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
      return { code: 0, data: { id: addResult._id, order_no: orderNo } }
    }

    if (action === 'pay') {
      const order = await orders.doc(data.id).get()
      if (!order.data) {
        return { code: -1, message: '订单不存在' }
      }
      if (order.data.openid !== openid) {
        return { code: -1, message: '无权操作此订单' }
      }
      if (order.data.status !== 'pending') {
        return { code: -1, message: '订单状态不正确' }
      }

      await orders.doc(data.id).update({
        data: {
          status: 'paid',
          paid: true,
          paidAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
      
      await sendOrderStatusNotification(openid, order.data.order_no, 'paid', '您的订单已支付成功，我们将尽快为您发货')
      
      return { code: 0, message: '支付成功' }
    }

    if (action === 'cancel') {
      const order = await orders.doc(data.id).get()
      if (!order.data) {
        return { code: -1, message: '订单不存在' }
      }
      if (order.data.openid !== openid) {
        return { code: -1, message: '无权操作此订单' }
      }
      if (order.data.status !== 'pending') {
        return { code: -1, message: '只能取消待支付订单' }
      }

      await restoreStock(order.data.items)

      await orders.doc(data.id).update({
        data: {
          status: 'cancelled',
          updatedAt: db.serverDate()
        }
      })
      
      await sendOrderStatusNotification(openid, order.data.order_no, 'cancelled', '您的订单已取消')
      
      return { code: 0, message: '订单已取消' }
    }

    if (action === 'confirm_receive') {
      const order = await orders.doc(data.id).get()
      if (!order.data) {
        return { code: -1, message: '订单不存在' }
      }
      if (order.data.openid !== openid) {
        return { code: -1, message: '无权操作此订单' }
      }
      if (order.data.status !== 'shipped' && order.data.status !== 'delivering') {
        return { code: -1, message: '订单未发货' }
      }

      await increaseSales(order.data.items)

      await orders.doc(data.id).update({
        data: {
          status: 'completed',
          receivedAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
      
      await sendOrderStatusNotification(openid, order.data.order_no, 'completed', '订单已完成，欢迎再次光临')
      
      return { code: 0, message: '确认收货成功' }
    }

    if (action === 'update_status') {
      const order = await orders.doc(data.id).get()
      if (!order.data) {
        return { code: -1, message: '订单不存在' }
      }

      if (data.status === 'cancelled' && order.data.status === 'pending') {
        await restoreStock(order.data.items)
      }

      await orders.doc(data.id).update({
        data: { 
          status: data.status,
          updatedAt: db.serverDate()
        }
      })
      
      await sendOrderStatusNotification(order.data.openid, order.data.order_no, data.status, data.remark || '')
      
      return { code: 0, message: '状态更新成功' }
    }

    if (action === 'delete') {
      const order = await orders.doc(data.id).get()
      if (!order.data) {
        return { code: -1, message: '订单不存在' }
      }
      if (order.data.openid !== openid) {
        return { code: -1, message: '无权删除此订单' }
      }
      if (!['cancelled', 'completed'].includes(order.data.status)) {
        return { code: -1, message: '只能删除已取消或已完成的订单' }
      }

      await orders.doc(data.id).remove()
      return { code: 0, message: '删除成功' }
    }

    if (action === 'expirePending') {
      const timeout = data.minutes || 30
      const expireTime = new Date(Date.now() - timeout * 60 * 1000)
      const expiredOrders = await orders.where({
        status: 'pending',
        createdAt: _.lte(expireTime)
      }).get()

      let restored = 0
      for (const order of expiredOrders.data) {
        try {
          await restoreStock(order.items)
          await orders.doc(order._id).update({
            data: { status: 'cancelled', cancel_reason: '超时未支付', updatedAt: db.serverDate() }
          })
          restored++
        } catch (e) {
          console.error('归还库存失败:', order._id, e.message)
        }
      }
      return { code: 0, message: `已处理 ${restored} 个超时订单` }
    }

    return { code: -1, message: '未知操作' }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}