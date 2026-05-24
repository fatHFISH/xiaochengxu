const app = getApp()

Page({
  data: {
    availableCoupons: [],
    myCoupons: []
  },

  goBack() {
    wx.navigateBack()
  },

  onShow() {
    this.loadCoupons()
    this.loadMyCoupons()
  },

  async loadCoupons() {
    try {
      const coupons = await app.callCloud('coupons', { action: 'list' })
      const formatted = coupons.map(c => ({
        ...c,
        startTimeStr: this.formatDate(c.startTime),
        endTimeStr: this.formatDate(c.endTime)
      }))
      this.setData({ availableCoupons: formatted })
    } catch (e) {}
  },

  async loadMyCoupons() {
    try {
      const coupons = await app.callCloud('coupons', { action: 'myCoupons', data: { status: 'unused' } })
      const formatted = coupons.map(c => ({
        ...c,
        expiresAtStr: this.formatDate(c.expiresAt)
      }))
      this.setData({ myCoupons: formatted })
    } catch (e) {}
  },

  async onReceive(e) {
    const id = e.currentTarget.dataset.id
    try {
      await app.callCloud('coupons', { action: 'receive', data: { couponId: id } })
      wx.showToast({ title: '领取成功', icon: 'success' })
      this.loadCoupons()
      this.loadMyCoupons()
    } catch (err) {
      wx.showToast({ title: err.message || '领取失败', icon: 'none' })
    }
  },

  formatDate(date) {
    if (!date) return ''
    const d = new Date(date)
    return `${d.getMonth() + 1}月${d.getDate()}日`
  }
})
