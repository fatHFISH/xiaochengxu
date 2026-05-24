const app = getApp()

Page({
  data: {
    orders: []
  },

  onShow() {
    this.loadLogistics()
  },

  async loadLogistics() {
    try {
      const result = await app.callCloud('logistics', { action: 'list' })
      const statusMap = {
        'pending': '待发货',
        'shipped': '已发货',
        'delivering': '运输中',
        'completed': '已签收'
      }
      const orders = (result.list || []).map(o => ({
        ...o,
        statusText: statusMap[o.status] || '未知',
        latestTrace: o.traces && o.traces.length > 0 ? o.traces[o.traces.length - 1].content : ''
      }))
      this.setData({ orders })
    } catch (e) {}
  },

  onOrderTap(e) {
    const id = e.currentTarget.dataset.id
    const pages = getCurrentPages()
    const indexPage = pages.find(p => p.route === 'pages/index/index')
    if (indexPage) {
      indexPage.navigateTo(5)
      wx.navigateBack()
    }
  }
})
