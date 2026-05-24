const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  try {
    const now = new Date()
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    
    // 初始化优惠券
    await db.collection('coupons').add({
      data: {
        name: '新用户专享券',
        type: 'discount',
        value: 10,
        minAmount: 50,
        total: 100,
        received: 0,
        limitPerUser: 1,
        startTime: now,
        endTime: futureDate,
        status: 'active',
        createdAt: db.serverDate()
      }
    })
    
    await db.collection('coupons').add({
      data: {
        name: '满减优惠券',
        type: 'discount',
        value: 20,
        minAmount: 100,
        total: 50,
        received: 0,
        limitPerUser: 1,
        startTime: now,
        endTime: futureDate,
        status: 'active',
        createdAt: db.serverDate()
      }
    })
    
    await db.collection('coupons').add({
      data: {
        name: '限时折扣券',
        type: 'discount',
        value: 30,
        minAmount: 150,
        total: 30,
        received: 0,
        limitPerUser: 1,
        startTime: now,
        endTime: futureDate,
        status: 'active',
        createdAt: db.serverDate()
      }
    })
    
    // 初始化地址集合（使用云开发 SDK 创建）
    try {
      await db.collection('addresses').count()
    } catch (e) {
      try {
        const cloudbase = require('@cloudbase/node-sdk')
        const app = cloudbase.init({ env: cloud.DYNAMIC_CURRENT_ENV })
        const tcbDb = app.database()
        await tcbDb.createCollection('addresses')
      } catch (e2) {
        try {
          const tempAddr = await db.collection('addresses').add({
            data: {
              _init_: true,
              _createdAt: db.serverDate()
            }
          })
          await db.collection('addresses').doc(tempAddr._id).remove()
        } catch (e3) {}
      }
    }
    
    // 初始化客服配置
    await db.collection('systemConfig').add({
      data: {
        key: 'customerService',
        value: {
          workingHours: '9:00-18:00',
          autoReply: '您好，欢迎咨询乌东苗寨小卖部！客服工作时间为9:00-18:00，如有问题请留言，我们会尽快回复您。',
          contactPhone: '',
          contactWechat: ''
        },
        createdAt: db.serverDate()
      }
    })
    
    return { 
      code: 0, 
      message: '初始化成功', 
      data: { 
        coupons: 3,
        systemConfig: 1
      } 
    }
  } catch (err) {
    return { code: -1, message: err.message }
  }
}
