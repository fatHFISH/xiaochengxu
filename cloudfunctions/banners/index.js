const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const { action, data = {} } = event
  const banners = db.collection('banners')

  try {
    if (action === 'list') {
      const query = data.type ? { type: data.type } : {}
      const result = await banners
        .where(query)
        .orderBy('sort', 'asc')
        .get()
      return { code: 0, data: result.data }
    }

    if (action === 'add') {
      const addResult = await banners.add({
        data: { ...data, sort: data.sort || 0, createdAt: db.serverDate() }
      })
      return { code: 0, data: { id: addResult._id } }
    }

    if (action === 'update') {
      const { id, ...updateData } = data
      await banners.doc(id).update({
        data: { ...updateData, updatedAt: db.serverDate() }
      })
      return { code: 0 }
    }

    if (action === 'delete') {
      await banners.doc(data.id).remove()
      return { code: 0 }
    }

    return { code: -1, message: '未知操作' }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}
