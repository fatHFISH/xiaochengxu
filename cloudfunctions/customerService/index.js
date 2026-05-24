const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event) => {
  const { action, data = {} } = event
  const { OPENID } = cloud.getWXContext()

  try {
    switch (action) {
      case 'send':
        return await sendMessage(OPENID, data)
      case 'list':
        return await getMessages(OPENID, data)
      case 'read':
        return await markAsRead(OPENID, data)
      case 'unread':
        return await getUnreadCount(OPENID)
      case 'adminList':
        return await getAdminMessages(data)
      case 'adminReply':
        return await adminReply(data)
      case 'config':
        return await getConfig()
      case 'ticket':
        return await createTicket(OPENID, data)
      case 'ticketList':
        return await getTicketList(OPENID, data)
      case 'adminTicketList':
        return await getAdminTicketList(data)
      case 'updateTicket':
        return await updateTicket(data)
      case 'notify':
        return await sendNotification(data)
      default:
        return { code: -1, message: '未知操作' }
    }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}

async function sendMessage(openid, data) {
  const { content, type = 'text', orderId, images = [] } = data
  
  if (!content && images.length === 0) {
    return { code: -1, message: '消息内容不能为空' }
  }
  
  const result = await db.collection('customerService').add({
    data: {
      openid,
      type,
      content,
      images,
      orderId: orderId || null,
      sender: 'user',
      status: 'unread',
      createdAt: db.serverDate()
    }
  })
  
  return { code: 0, message: '发送成功', data: { id: result._id } }
}

async function getMessages(openid, data) {
  const { page = 1, pageSize = 20 } = data
  
  const total = await db.collection('customerService')
    .where({ openid })
    .count()
  
  const messages = await db.collection('customerService')
    .where({ openid })
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    code: 0,
    message: '获取成功',
    data: {
      list: messages.data.reverse(),
      total: total.total,
      page,
      pageSize
    }
  }
}

async function markAsRead(openid, data) {
  const { messageIds } = data
  
  await db.collection('customerService')
    .where({
      _id: _.in(messageIds),
      openid,
      sender: 'admin'
    })
    .update({
      data: { status: 'read' }
    })
  
  return { code: 0, message: '标记已读成功' }
}

async function getUnreadCount(openid) {
  const count = await db.collection('customerService')
    .where({
      openid,
      sender: 'admin',
      status: 'unread'
    })
    .count()
  
  return {
    code: 0,
    message: '获取成功',
    data: { count: count.total }
  }
}

async function getAdminMessages(data) {
  const { page = 1, pageSize = 20, status, openid } = data
  
  let condition = {}
  if (status) {
    condition.status = status
  }
  if (openid) {
    condition.openid = openid
  }
  
  const total = await db.collection('customerService')
    .where(condition)
    .count()
  
  const messages = await db.collection('customerService')
    .where(condition)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  const userOpenids = [...new Set(messages.data.map(m => m.openid))]
  let users = {}
  
  if (userOpenids.length > 0) {
    const usersRes = await db.collection('users')
      .where({ openid: _.in(userOpenids) })
      .get()
    usersRes.data.forEach(u => { users[u.openid] = u })
  }
  
  const list = messages.data.map(m => ({
    ...m,
    user: users[m.openid] || { nickname: '未知用户', avatar: '' }
  }))
  
  return {
    code: 0,
    message: '获取成功',
    data: {
      list,
      total: total.total,
      page,
      pageSize
    }
  }
}

async function adminReply(data) {
  const { userId, content, type = 'text', images = [] } = data
  
  if (!content && images.length === 0) {
    return { code: -1, message: '回复内容不能为空' }
  }
  
  const result = await db.collection('customerService').add({
    data: {
      openid: userId,
      type,
      content,
      images,
      sender: 'admin',
      status: 'unread',
      createdAt: db.serverDate()
    }
  })
  
  return { code: 0, message: '回复成功', data: { id: result._id } }
}

async function getConfig() {
  const config = await db.collection('systemConfig')
    .where({ key: 'customerService' })
    .get()
  
  if (config.data.length === 0) {
    return {
      code: 0,
      message: '获取成功',
      data: {
        workingHours: '9:00-18:00',
        autoReply: '您好，欢迎咨询乌东苗寨小卖部！客服工作时间为9:00-18:00，如有问题请留言，我们会尽快回复您。',
        contactPhone: '',
        contactWechat: ''
      }
    }
  }
  
  return {
    code: 0,
    message: '获取成功',
    data: config.data[0].value
  }
}

async function createTicket(openid, data) {
  const { title, content, type = 'general', orderId, images = [] } = data
  
  if (!title) {
    return { code: -1, message: '工单标题不能为空' }
  }
  if (!content) {
    return { code: -1, message: '工单内容不能为空' }
  }
  
  const result = await db.collection('tickets').add({
    data: {
      openid,
      title,
      content,
      type,
      orderId: orderId || null,
      images,
      status: 'open',
      priority: 'normal',
      assignee: null,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })
  
  return { code: 0, message: '工单创建成功', data: { id: result._id } }
}

async function getTicketList(openid, data) {
  const { page = 1, pageSize = 10, status } = data
  
  let condition = { openid }
  if (status) {
    condition.status = status
  }
  
  const total = await db.collection('tickets').where(condition).count()
  
  const tickets = await db.collection('tickets')
    .where(condition)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  return {
    code: 0,
    message: '获取成功',
    data: {
      list: tickets.data,
      total: total.total,
      page,
      pageSize
    }
  }
}

async function getAdminTicketList(data) {
  const { page = 1, pageSize = 20, status, type, assignee } = data
  
  let condition = {}
  if (status) condition.status = status
  if (type) condition.type = type
  if (assignee) condition.assignee = assignee
  
  const total = await db.collection('tickets').where(condition).count()
  
  const tickets = await db.collection('tickets')
    .where(condition)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()
  
  const userOpenids = [...new Set(tickets.data.map(t => t.openid))]
  let users = {}
  
  if (userOpenids.length > 0) {
    const usersRes = await db.collection('users')
      .where({ openid: _.in(userOpenids) })
      .get()
    usersRes.data.forEach(u => { users[u.openid] = u })
  }
  
  const list = tickets.data.map(t => ({
    ...t,
    user: users[t.openid] || { nickname: '未知用户', avatar: '' }
  }))
  
  return {
    code: 0,
    message: '获取成功',
    data: {
      list,
      total: total.total,
      page,
      pageSize
    }
  }
}

async function updateTicket(data) {
  const { ticketId, status, assignee, reply } = data
  
  if (!ticketId) {
    return { code: -1, message: '工单ID不能为空' }
  }
  
  const ticket = await db.collection('tickets').doc(ticketId).get()
  if (!ticket.data) {
    return { code: -1, message: '工单不存在' }
  }
  
  const updateData = { updatedAt: db.serverDate() }
  if (status) updateData.status = status
  if (assignee) updateData.assignee = assignee
  if (reply) {
    updateData.replies = ticket.data.replies || []
    updateData.replies.push({
      content: reply,
      sender: 'admin',
      createdAt: db.serverDate()
    })
  }
  
  await db.collection('tickets').doc(ticketId).update({
    data: updateData
  })
  
  return { code: 0, message: '工单更新成功' }
}

async function sendNotification(data) {
  const { openid, title, content, type = 'system' } = data
  
  if (!openid || !title || !content) {
    return { code: -1, message: '参数不完整' }
  }
  
  await db.collection('notifications').add({
    data: {
      openid,
      title,
      content,
      type,
      read: false,
      createdAt: db.serverDate()
    }
  })
  
  return { code: 0, message: '通知发送成功' }
}
