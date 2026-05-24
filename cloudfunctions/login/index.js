const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const users = db.collection('users')
    const userResult = await users.where({ openid }).get()

    if (userResult.data.length === 0) {
      const newUser = {
        openid,
        nickname: event.nickname || '微信用户',
        avatar: event.avatar || '',
        phone: event.phone || '',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
      const addResult = await users.add({ data: newUser })
      return {
        code: 0,
        message: '注册成功',
        data: {
          id: addResult._id,
          openid: newUser.openid,
          nickname: newUser.nickname,
          avatar: newUser.avatar,
          phone: newUser.phone
        }
      }
    } else {
      const user = userResult.data[0]
      await users.doc(user._id).update({
        data: {
          nickname: event.nickname || user.nickname,
          avatar: event.avatar || user.avatar,
          updatedAt: db.serverDate()
        }
      })
      const updated = await users.doc(user._id).get()
      const userData = updated.data || user
      return {
        code: 0,
        message: '登录成功',
        data: {
          id: userData._id,
          openid: userData.openid,
          nickname: userData.nickname,
          avatar: userData.avatar,
          phone: userData.phone
        }
      }
    }
  } catch (err) {
    return {
      code: -1,
      message: '操作失败',
      error: err
    }
  }
}
