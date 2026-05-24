const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function ensureAddressCollection() {
  const name = 'addresses'
  try {
    await db.collection(name).count()
    return true
  } catch (e) {
    try {
      const cloudbase = require('@cloudbase/node-sdk')
      const app = cloudbase.init({ env: cloud.DYNAMIC_CURRENT_ENV })
      const tcbDb = app.database()
      await tcbDb.createCollection(name)
      return true
    } catch (e2) {
      try {
        const result = await db.collection(name).add({
          data: { _init_: true, _createdAt: db.serverDate() }
        })
        await db.collection(name).doc(result._id).remove()
        return true
      } catch (e3) {
        return false
      }
    }
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action, data = {} } = event
  const addresses = db.collection('addresses')

  const exists = await ensureAddressCollection()
  if (!exists) {
    return {
      code: -1,
      message: '数据库 [addresses] 集合不存在，请在微信开发者工具 → 云开发 → 数据库 中手动创建名为 "addresses" 的集合'
    }
  }

  try {
    if (action === 'list') {
      const result = await addresses.where({ openid }).orderBy('is_default', 'desc').get()
      return { code: 0, data: result.data }
    }

    if (action === 'add') {
      if (data.is_default) {
        await addresses.where({ openid }).update({ data: { is_default: false } })
      }
      const addResult = await addresses.add({
        data: { ...data, openid, createdAt: db.serverDate() }
      })
      return { code: 0, data: { id: addResult._id } }
    }

    if (action === 'update') {
      const { id, ...updateFields } = data
      if (updateFields.is_default) {
        await addresses.where({ openid, _id: _.neq(id) }).update({ data: { is_default: false } })
      }
      await addresses.doc(id).update({ data: { ...updateFields, updatedAt: db.serverDate() } })
      return { code: 0 }
    }

    if (action === 'delete') {
      await addresses.doc(data.id).remove()
      return { code: 0 }
    }

    if (action === 'set_default') {
      await addresses.where({ openid }).update({ data: { is_default: false } })
      await addresses.doc(data.id).update({ data: { is_default: true } })
      return { code: 0 }
    }

    return { code: -1, message: '未知操作' }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}
