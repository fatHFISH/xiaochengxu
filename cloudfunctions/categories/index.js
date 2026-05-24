const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action, data = {} } = event
  const categories = db.collection('categories')

  try {
    if (action === 'list') {
      const result = await categories.orderBy('sort', 'asc').get()
      return { code: 0, data: result.data }
    }

    if (action === 'add') {
      const addResult = await categories.add({
        data: { ...data, sort: data.sort || 0, createdAt: db.serverDate() }
      })
      return { code: 0, data: { id: addResult._id } }
    }

    if (action === 'update') {
      const { id, ...updateData } = data
      await categories.doc(id).update({
        data: { ...updateData, updatedAt: db.serverDate() }
      })
      return { code: 0 }
    }

    if (action === 'delete') {
      await categories.doc(data.id).remove()
      return { code: 0 }
    }

    if (action === 'fixTeaImage') {
      const fixed = []
      const catResult = await categories.where({ name: '茶叶' }).get()
      if (catResult.data.length > 0) {
        const teaCategory = catResult.data[0]
        const oldImage = teaCategory.image || ''
        const newImage = oldImage.replace('tea.jpg', 'chaye.jpg')
        if (oldImage !== newImage) {
          await categories.doc(teaCategory._id).update({
            data: { image: newImage, updatedAt: db.serverDate() }
          })
          fixed.push({ type: '分类', old: oldImage, new: newImage })
        }
      }
      const products = db.collection('products')
      const teaProducts = await products.where({
        image: db.RegExp({ regexp: 'tea\\.jpg', options: 'i' })
      }).get()
      for (const p of teaProducts.data) {
        const newImage = (p.image || '').replace('tea.jpg', 'chaye.jpg')
        if (newImage !== p.image) {
          await products.doc(p._id).update({
            data: { image: newImage, updatedAt: db.serverDate() }
          })
          fixed.push({ type: '商品', id: p._id, name: p.name, old: p.image, new: newImage })
        }
        if (p.image_cloud) {
          const newCloud = p.image_cloud.replace('tea.jpg', 'chaye.jpg')
          if (newCloud !== p.image_cloud) {
            await products.doc(p._id).update({
              data: { image_cloud: newCloud }
            })
          }
        }
      }
      return { code: 0, message: `修复完成，共修复 ${fixed.length} 处`, data: fixed }
    }

    return { code: -1, message: '未知操作' }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}
