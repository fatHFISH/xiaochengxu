const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action, data = {} } = event
  const carts = db.collection('carts')

  try {
    if (action === 'list') {
      const cartItems = await carts.where({ openid }).get()
      
      const productIds = cartItems.data.map(item => item.product_id)
      let productsMap = {}
      
      if (productIds.length > 0) {
        const productsRes = await db.collection('products')
          .where({ _id: _.in(productIds) })
          .get()
        productsRes.data.forEach(p => { productsMap[p._id] = p })
      }
      
      const list = cartItems.data.map(item => {
        const product = productsMap[item.product_id] || {}
        return {
          ...item,
          product,
          stock: product.stock || 0,
          available: product.status === 1 && (product.stock || 0) > 0
        }
      })
      
      return { code: 0, data: list }
    }

    if (action === 'add') {
      if (!data.product_id) {
        return { code: -1, message: '商品ID不能为空' }
      }
      
      const product = await db.collection('products').doc(data.product_id).get()
      if (!product.data) {
        return { code: -1, message: '商品不存在' }
      }
      
      const status = product.data.status !== undefined ? product.data.status : 1
      if (status !== 1) {
        return { code: -1, message: '商品已下架' }
      }
      
      const quantity = data.quantity || 1
      const stock = product.data.stock !== undefined ? product.data.stock : 999
      if (stock < quantity) {
        return { code: -1, message: '库存不足' }
      }
      
      const existing = await carts.where({
        openid,
        product_id: data.product_id
      }).get()

      if (existing.data.length > 0) {
        const cart = existing.data[0]
        const newQuantity = cart.quantity + quantity
        if (stock < newQuantity) {
          return { code: -1, message: '库存不足' }
        }
        await carts.doc(cart._id).update({
          data: { quantity: newQuantity, updatedAt: db.serverDate() }
        })
        return { code: 0, message: '数量已更新', data: { id: cart._id } }
      } else {
        const addResult = await carts.add({
          data: {
            openid,
            product_id: data.product_id,
            quantity: quantity,
            selected: true,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        })
        return { code: 0, message: '已加入购物车', data: { id: addResult._id } }
      }
    }

    if (action === 'update') {
      if (!data.id) {
        return { code: -1, message: '购物车ID不能为空' }
      }
      
      const cart = await carts.doc(data.id).get()
      if (!cart.data) {
        return { code: -1, message: '购物车项不存在' }
      }
      if (cart.data.openid !== openid) {
        return { code: -1, message: '无权操作' }
      }
      
      if (data.quantity !== undefined) {
        if (data.quantity <= 0) {
          return { code: -1, message: '数量必须大于0' }
        }
        
        const product = await db.collection('products').doc(cart.data.product_id).get()
        if (product.data && product.data.stock && product.data.stock < data.quantity) {
          return { code: -1, message: '库存不足' }
        }
      }
      
      await carts.doc(data.id).update({
        data: { quantity: data.quantity, selected: data.selected, updatedAt: db.serverDate() }
      })
      return { code: 0, message: '更新成功' }
    }

    if (action === 'delete') {
      const cart = await carts.doc(data.id).get()
      if (!cart.data) {
        return { code: -1, message: '购物车项不存在' }
      }
      if (cart.data.openid !== openid) {
        return { code: -1, message: '无权操作' }
      }
      
      await carts.doc(data.id).remove()
      return { code: 0, message: '删除成功' }
    }

    if (action === 'batchDelete') {
      if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
        return { code: -1, message: '请选择要删除的商品' }
      }
      
      await carts.where({
        _id: _.in(data.ids),
        openid
      }).remove()
      return { code: 0, message: '删除成功' }
    }

    if (action === 'clear') {
      await carts.where({ openid }).remove()
      return { code: 0, message: '购物车已清空' }
    }

    if (action === 'select_all') {
      await carts.where({ openid }).update({
        data: { selected: data.selected !== false }
      })
      return { code: 0, message: '操作成功' }
    }

    if (action === 'getSelected') {
      const cartItems = await carts.where({ openid, selected: true }).get()
      
      if (cartItems.data.length === 0) {
        return { code: 0, data: { items: [], totalAmount: 0 } }
      }
      
      const productIds = cartItems.data.map(item => item.product_id)
      const productsRes = await db.collection('products')
        .where({ _id: _.in(productIds) })
        .get()
      
      const productsMap = {}
      productsRes.data.forEach(p => { productsMap[p._id] = p })
      
      const items = cartItems.data.map(item => {
        const product = productsMap[item.product_id] || {}
        return {
          ...item,
          product,
          subtotal: (product.price || 0) * item.quantity
        }
      }).filter(item => item.product._id)
      
      const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0)
      
      return { 
        code: 0, 
        data: { 
          items, 
          totalAmount: parseFloat(totalAmount.toFixed(2)),
          count: items.length
        } 
      }
    }

    return { code: -1, message: '未知操作' }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}
