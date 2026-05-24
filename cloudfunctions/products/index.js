const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action, data = {} } = event
  const products = db.collection('products')

  try {
    if (action === 'list') {
      const { page = 1, page_size = 20, category_id, is_hot, is_featured, keyword, status } = data
      let query = {}
      if (category_id) query.category_id = category_id
      if (is_hot === '1') query.is_hot = true
      if (is_featured === '1') query.is_featured = true
      if (status !== undefined) query.status = status
      if (keyword) query.name = db.RegExp({ regexp: keyword, options: 'i' })

      const result = await products
        .where(query)
        .orderBy('sort', 'asc')
        .skip((page - 1) * page_size)
        .limit(page_size)
        .get()

      const countResult = await products.where(query).count()
      
      return { code: 0, data: { list: result.data, total: countResult.total } }
    }

    if (action === 'detail') {
      const result = await products.doc(data.id).get()
      if (!result.data) {
        return { code: -1, message: '商品不存在' }
      }
      
      await products.doc(data.id).update({
        data: { views: _.inc(1) }
      })
      
      return { code: 0, data: result.data }
    }

    if (action === 'add') {
      if (!data.name) {
        return { code: -1, message: '商品名称不能为空' }
      }
      if (!data.price || data.price <= 0) {
        return { code: -1, message: '商品价格不正确' }
      }
      
      const addResult = await products.add({
        data: { 
          ...data, 
          sales: 0, 
          views: 0,
          stock: data.stock || 0,
          status: data.status !== undefined ? data.status : 1,
          sort: data.sort || 0, 
          createdAt: db.serverDate(),
          updatedAt: db.serverDate()
        }
      })
      return { code: 0, message: '商品添加成功', data: { id: addResult._id } }
    }

    if (action === 'update') {
      if (!data.id) {
        return { code: -1, message: '商品ID不能为空' }
      }
      
      const product = await products.doc(data.id).get()
      if (!product.data) {
        return { code: -1, message: '商品不存在' }
      }
      
      const { id, ...updateData } = data
      updateData.updatedAt = db.serverDate()
      
      await products.doc(id).update({ data: updateData })
      return { code: 0, message: '商品更新成功' }
    }

    if (action === 'delete') {
      if (!data.id) {
        return { code: -1, message: '商品ID不能为空' }
      }
      
      const product = await products.doc(data.id).get()
      if (!product.data) {
        return { code: -1, message: '商品不存在' }
      }
      
      await products.doc(data.id).remove()
      return { code: 0, message: '商品删除成功' }
    }

    if (action === 'updateStock') {
      if (!data.id) {
        return { code: -1, message: '商品ID不能为空' }
      }
      if (data.stock === undefined || data.stock < 0) {
        return { code: -1, message: '库存数量不正确' }
      }
      
      await products.doc(data.id).update({
        data: { stock: data.stock, updatedAt: db.serverDate() }
      })
      return { code: 0, message: '库存更新成功' }
    }

    if (action === 'updateStatus') {
      if (!data.id) {
        return { code: -1, message: '商品ID不能为空' }
      }
      if (![0, 1].includes(data.status)) {
        return { code: -1, message: '状态值不正确（0:下架, 1:上架）' }
      }
      
      await products.doc(data.id).update({
        data: { status: data.status, updatedAt: db.serverDate() }
      })
      return { code: 0, message: data.status === 1 ? '商品已上架' : '商品已下架' }
    }

    if (action === 'batchUpdateStatus') {
      if (!data.ids || !Array.isArray(data.ids) || data.ids.length === 0) {
        return { code: -1, message: '请选择要操作的商品' }
      }
      if (![0, 1].includes(data.status)) {
        return { code: -1, message: '状态值不正确（0:下架, 1:上架）' }
      }
      
      await products.where({
        _id: _.in(data.ids)
      }).update({
        data: { status: data.status, updatedAt: db.serverDate() }
      })
      return { code: 0, message: data.status === 1 ? '批量上架成功' : '批量下架成功' }
    }

    if (action === 'hot') {
      const { limit = 10 } = data
      const result = await products
        .where({ status: 1, is_hot: true })
        .orderBy('sales', 'desc')
        .limit(limit)
        .get()
      
      return { code: 0, data: result.data }
    }

    if (action === 'featured') {
      const { limit = 10 } = data
      const result = await products
        .where({ status: 1, is_featured: true })
        .orderBy('sort', 'asc')
        .limit(limit)
        .get()
      
      return { code: 0, data: result.data }
    }

    return { code: -1, message: '未知操作' }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}