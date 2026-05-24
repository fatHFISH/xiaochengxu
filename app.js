App({
  globalData: {
    userInfo: null,
    openid: null,
    urlCache: {}
  },

  fixCloudFileId(fileID) {
    if (!fileID || typeof fileID !== 'string') return fileID
    if (!fileID.startsWith('cloud://') && !fileID.startsWith('coud://')) return fileID
    let fixed = fileID
    if (fixed.startsWith('coud://')) {
      fixed = 'cloud://' + fixed.slice(6)
    }
    fixed = fixed.replace(/\s+(jpe?g|png|gif|webp|svg|bmp|ico)$/i, '.$1')
    fixed = fixed.replace(/,(jpe?g|png|gif|webp|svg|bmp|ico)$/i, '.$1')
    fixed = fixed.replace(/([^.])jpeg$/i, '$1.jpeg')
    fixed = fixed.replace(/([^.])jpge$/i, '$1.jpeg')
    fixed = fixed.replace(/([^.])jpg$/i, '$1.jpg')
    fixed = fixed.replace(/([^.])png$/i, '$1.png')
    fixed = fixed.replace(/([^.])gif$/i, '$1.gif')
    fixed = fixed.replace(/([^.])webp$/i, '$1.webp')
    fixed = fixed.replace(/([^.])svg$/i, '$1.svg')
    fixed = fixed.replace(/([^.])bmp$/i, '$1.bmp')
    fixed = fixed.replace(/\s+(\.\w+)$/, '$1')
    return fixed
  },

  onLaunch() {
    wx.cloud.init({
      env: 'cloud1-d2ga1cyam2db88c94',
      traceUser: true
    })
    
    const cache = wx.getStorageSync('urlCache')
    if (cache) {
      const now = Date.now()
      const validCache = {}
      for (const key in cache) {
        if (cache[key].expire > now) {
          validCache[key] = cache[key].url
        }
      }
      this.globalData.urlCache = validCache
    }
    
    // 清除可能过期的旧缓存
    const oldCache = wx.getStorageSync('imageUrlCache')
    if (oldCache) {
      wx.removeStorageSync('imageUrlCache')
    }
  },

  callCloud(name, data = {}) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name,
        data,
        timeout: 10000,
        success: res => {
          if (res.result && res.result.code === 0) {
            resolve(res.result.data)
          } else {
            reject(res.result || res)
          }
        },
        fail: err => reject(err)
      })
    })
  },

  getImageUrl(fileID) {
    const fixed = this.fixCloudFileId(fileID)
    if (!fixed || !fixed.startsWith('cloud://')) return Promise.resolve(fixed || '')
    if (this.globalData.urlCache[fixed]) {
      return Promise.resolve(this.globalData.urlCache[fixed])
    }
    return this.callCloud('getTempURL', { fileList: [fixed] }).then(urlMapData => {
      const url = (urlMapData && urlMapData[fixed]) || ''
      if (url) {
        this.globalData.urlCache[fixed] = url
        this._saveUrlCache()
      }
      return url || fixed
    }).catch(() => fixed)
  },

  getImageUrls(fileIDs) {
    if (!fileIDs || !Array.isArray(fileIDs) || fileIDs.length === 0) return Promise.resolve([])
    const fixedIDs = fileIDs.map(id => this.fixCloudFileId(id))
    const cloudFileIDs = fixedIDs.filter(id => id && id.startsWith('cloud://'))
    if (cloudFileIDs.length === 0) return Promise.resolve(fixedIDs)
    
    const cached = {}
    const needFetch = []
    cloudFileIDs.forEach(id => {
      if (this.globalData.urlCache[id]) {
        cached[id] = this.globalData.urlCache[id]
      } else {
        needFetch.push(id)
      }
    })
    
    if (needFetch.length === 0) {
      return Promise.resolve(fixedIDs.map(id => cached[id] || id || ''))
    }
    
    return this.callCloud('getTempURL', { fileList: needFetch }).then(urlMapData => {
      if (urlMapData) {
        Object.keys(urlMapData).forEach(fileId => {
          const url = urlMapData[fileId] || ''
          if (url) {
            this.globalData.urlCache[fileId] = url
          }
        })
        this._saveUrlCache()
      }
      return fixedIDs.map(id => cached[id] || this.globalData.urlCache[id] || id || '')
    }).catch(() => {
      return fixedIDs.map(id => cached[id] || id || '')
    })
  },

  _saveUrlCache() {
    const cacheData = {}
    for (const key in this.globalData.urlCache) {
      cacheData[key] = {
        url: this.globalData.urlCache[key],
        expire: Date.now() + 90 * 60 * 1000
      }
    }
    try {
      wx.setStorageSync('urlCache', cacheData)
    } catch (e) {}
  },

  search(data) { return this.callCloud('search', data) },
  favorites(data) { return this.callCloud('favorites', data) },
  reviews(data) { return this.callCloud('reviews', data) },
  coupons(data) { return this.callCloud('coupons', data) },
  stats(data) { return this.callCloud('stats', data) },
  logistics(data) { return this.callCloud('logistics', data) },
  customerService(data) { return this.callCloud('customerService', data) },
  analytics(data) { return this.callCloud('analytics', data) }
})