const app = getApp()

Page({
  data: {
    favorites: [],
    total: 0,
    loading: false
  },

  onShow() {
    this.loadFavorites()
  },

  async loadFavorites() {
    this.setData({ loading: true })
    try {
      const result = await app.callCloud('favorites', { action: 'list', data: { page: 1, pageSize: 50 } })
      const products = (result.list || []).map(p => ({
        id: p._id,
        name: p.name,
        desc: p.short_desc,
        price: p.price.toFixed(2),
        image: p.image,
        emoji: p.emoji,
        bgColor: p.bg_color
      }))

      const cloudImages = products.map(p => p.image).filter(url => url && url.startsWith('cloud://'))
      const urlMap = {}
      if (cloudImages.length > 0) {
        const urls = await app.getImageUrls([...new Set(cloudImages)])
        cloudImages.forEach((id, i) => { urlMap[id] = urls[i] })
      }
      const convertUrl = (url) => urlMap[url] || url || ''

      this.setData({
        favorites: products.map(p => ({ ...p, image: convertUrl(p.image) })),
        total: result.total,
        loading: false
      })
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  onProductTap(e) {
    const pages = getCurrentPages()
    const indexPage = pages.find(p => p.route === 'pages/index/index')
    if (indexPage) {
      indexPage.loadProductDetail(e.currentTarget.dataset.id)
      wx.navigateBack()
    }
  },

  async onAddCart(e) {
    const id = e.currentTarget.dataset.id
    try {
      await app.callCloud('cart', { action: 'add', data: { product_id: id, quantity: 1 } })
      wx.showToast({ title: '已加入购物车', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '添加失败', icon: 'none' })
    }
  },

  async onRemove(e) {
    const id = e.currentTarget.dataset.id
    try {
      await app.callCloud('favorites', { action: 'remove', data: { productId: id } })
      this.loadFavorites()
      wx.showToast({ title: '已移除', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' })
    }
  },

  goHome() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onImageError() {}
})
