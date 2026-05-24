const app = getApp()

Page({
  data: {
    keyword: '',
    searchHistory: [],
    hotSearches: [],
    searchResults: [],
    total: 0,
    sortBy: 'default',
    sortOrder: 'desc',
    page: 1,
    loading: false,
    hasMore: true
  },

  onLoad(options) {
    this.loadHistory()
    this.loadHotSearches()
    if (options && options.keyword) {
      this.setData({ keyword: decodeURIComponent(options.keyword) })
      setTimeout(() => this.onSearch(), 300)
    }
  },

  async loadHistory() {
    try {
      const history = await app.callCloud('search', { action: 'history' })
      this.setData({ searchHistory: history })
    } catch (e) {}
  },

  async loadHotSearches() {
    try {
      const hot = await app.callCloud('search', { action: 'hot' })
      this.setData({ hotSearches: hot })
    } catch (e) {}
  },

  onInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onClear() {
    this.setData({ keyword: '', searchResults: [], total: 0 })
  },

  onCancel() {
    wx.navigateBack()
  },

  async onSearch() {
    const keyword = this.data.keyword.trim()
    if (!keyword) return

    this.setData({ searchResults: [], page: 1, hasMore: true })
    await this.doSearch(keyword)

    // 记录搜索历史
    try {
      await app.callCloud('search', { action: 'save', data: { keyword } })
      this.loadHistory()
    } catch (e) {}
  },

  async doSearch(keyword) {
    if (this.data.loading || !this.data.hasMore) return
    this.setData({ loading: true })

    try {
      const params = {
        action: 'search',
        data: {
          keyword,
          sortBy: this.data.sortBy === 'default' ? undefined : this.data.sortBy,
          sortOrder: this.data.sortOrder,
          page: this.data.page,
          pageSize: 10
        }
      }
      const result = await app.callCloud('search', params)
      const products = (result.list || []).map(p => ({
        id: p._id,
        name: p.name,
        desc: p.short_desc,
        price: p.price.toFixed(2),
        sales: p.sales,
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

      const converted = products.map(p => ({ ...p, image: convertUrl(p.image) }))

      this.setData({
        searchResults: this.data.page === 1 ? converted : [...this.data.searchResults, ...converted],
        total: result.total,
        hasMore: this.data.page < result.totalPages,
        page: this.data.page + 1,
        loading: false
      })
    } catch (e) {
      this.setData({ loading: false })
    }
  },

  onHistoryTap(e) {
    const keyword = e.currentTarget.dataset.keyword
    this.setData({ keyword })
    this.onSearch()
  },

  async onClearHistory() {
    wx.showModal({
      title: '提示',
      content: '确定要清空所有搜索历史吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await app.callCloud('search', { action: 'clearHistory' })
            this.setData({ searchHistory: [] })
          } catch (e) {}
        }
      }
    })
  },

  async onDeleteHistoryItem(e) {
    const keyword = e.currentTarget.dataset.keyword
    try {
      await app.callCloud('search', { action: 'deleteHistoryItem', data: { keyword } })
      const history = this.data.searchHistory.filter(item => item !== keyword)
      this.setData({ searchHistory: history })
    } catch (e) {}
  },

  onSortTap(e) {
    const sort = e.currentTarget.dataset.sort
    let sortOrder = 'desc'
    if (sort === this.data.sortBy) {
      sortOrder = this.data.sortOrder === 'asc' ? 'desc' : 'asc'
    }
    this.setData({ sortBy: sort, sortOrder, searchResults: [], page: 1, hasMore: true })
    this.doSearch(this.data.keyword)
  },

  onProductTap(e) {
    const pages = getCurrentPages()
    const indexPage = pages.find(p => p.route === 'pages/index/index')
    if (indexPage) {
      indexPage.loadProductDetail(e.currentTarget.dataset.id)
      wx.navigateBack()
    }
  },

  onImageError() {},

  onReachBottom() {
    this.doSearch(this.data.keyword)
  }
})
