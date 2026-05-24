const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action, data = {} } = event
  const users = db.collection('users')

  try {
    if (action === 'profile') {
      const result = await users.where({ openid }).get()
      if (result.data.length === 0) {
        return { code: -1, message: '用户不存在' }
      }
      return { code: 0, data: result.data[0] }
    }

    if (action === 'update') {
      await users.where({ openid }).update({
        data: { ...data, updatedAt: db.serverDate() }
      })
      return { code: 0 }
    }

    return { code: -1, message: '未知操作' }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}
