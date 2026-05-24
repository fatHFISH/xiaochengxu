const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action, data = {} } = event
  const notifications = db.collection('notifications')

  try {
    if (action === 'list') {
      const { page = 1, page_size = 20, type } = data
      let query = { openid }
      if (type) query.type = type

      const result = await notifications
        .where(query)
        .orderBy('createdAt', 'desc')
        .skip((page - 1) * page_size)
        .limit(page_size)
        .get()

      const countResult = await notifications.where(query).count()
      return { code: 0, data: { list: result.data, total: countResult.total } }
    }

    if (action === 'unreadCount') {
      const result = await notifications.where({
        openid,
        read: false
      }).count()
      return { code: 0, data: { count: result.total } }
    }

    if (action === 'markRead') {
      const { ids } = data
      if (ids && Array.isArray(ids) && ids.length > 0) {
        await notifications.where({
          _id: _.in(ids),
          openid
        }).update({
          data: { read: true }
        })
      } else {
        await notifications.where({
          openid,
          read: false
        }).update({
          data: { read: true }
        })
      }
      return { code: 0, message: '已标记为已读' }
    }

    if (action === 'delete') {
      const { ids } = data
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return { code: -1, message: '请选择要删除的通知' }
      }
      await notifications.where({
        _id: _.in(ids),
        openid
      }).remove()
      return { code: 0, message: '删除成功' }
    }

    return { code: -1, message: '未知操作' }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}