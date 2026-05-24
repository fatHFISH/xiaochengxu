// pages/index/index.js
const app = getApp();

Page({
  data: {
    // Banner图片
    bannerImage: '',
    secondBannerImage: '',

    // 加载状态
    loading: true,
    refreshingHome: false,

    // 当前页面索引
    currentPage: 0,
    pageNames: ['首页', '分类', '详情', '购物车', '地址', '支付', '成功', '我的', '全部订单', '订单详情', '发现'],
    pageHistory: [],
    pageScrollTop: {},

    // 页面切换动画
    pageTransition: '',

    // 底部导航
    currentNavTab: 0,
    homeNavTabs: [
      { label: '首页', icon: '/assets/icons/icon-home.png', badge: 0, pageIndex: 0 },
      { label: '分类', icon: '/assets/icons/icon-category.png', badge: 0, pageIndex: 1 },
      { label: '发现', icon: '/assets/icons/icon-discover.png', badge: 0, pageIndex: 10 },
      { label: '购物车', icon: '/assets/icons/icon-cart.png', badge: 0, pageIndex: 3 },
      { label: '我的', icon: '/assets/icons/icon-profile.png', badge: 0, pageIndex: 7 }
    ],

    // 服务标签
    serviceTags: [
      { icon: '/assets/icons/icon-quality-guarantee.png', text: '正品保障' },
      { icon: '/assets/icons/icon-direct-supply.png', text: '产地直供' },
      { icon: '/assets/icons/icon-craftsmanship.png', text: '传统工艺' },
      { icon: '/assets/icons/icon-after-sales.png', text: '售后无忧' }
    ],

    // 搜索
    searchKeyword: '',
    searchResults: [],

    // ========== 页面0: 首页 Home ==========
    homeCategories: [],
    hotProducts: [],
    featuredProducts: [],
    
    // ========== 页面10: 发现 Discover ==========
    discoverLoading: false,
    discoverBanners: [],
    discoverFeatured: [],
    discoverNewArrivals: [],
    
    // ========== 页面1: 商品分类 Category ==========
    categoryList: ['全部商品'],
    selectedCategory: 0,
    categoryAllProducts: [],
    categoryProducts: [],
    categoryPage: 1,
    categoryHasMore: false,
    categoryLoading: false,
    categoryEmpty: false,

    // ========== 页面2: 商品详情 Product Details ==========
    curProductId: null,
    productDetail: null,

    // ========== 页面3: 购物车 Shopping Cart ==========
    cartItems: [],
    isEditCart: false,
    isSelectAll: false,
    totalPrice: 0,
    selectedCount: 0,

    // ========== 页面4: 地址选择 Address Selection ==========
    addressList: [],
    addressFromCheckout: null,
    selectedAddressIndex: 0,
    orderItems: [],

    // ========== 页面5: 确认支付订单 Checkout ==========
    checkoutAddress: null,
    checkoutItems: [],
    checkoutTotal: '0.00',
    checkoutPayAmount: '0.00',
    selectedPayment: 'wechat',
    myAvailableCoupons: [],
    selectedCoupon: null,
    showCouponPicker: false,

    // ========== 页面6: 支付成功 Success Page ==========
    orderNo: '',
    recommendProducts: [],

    // ========== 页面7: 个人中心 User Profile ==========
    userInfo: {
      nickname: '微信用户',
      welcome: '欢迎来到乌东苗寨小卖部',
      avatar: 'cloud://cloud1-d2ga1cyam2db88c94.636c-cloud1-d2ga1cyam2db88c94-1436162449/cloud-images/avatar.png'
    },
    profileFavCount: 0,
    profileCouponCount: 0,
    orderStatusItems: [
      { status: 'pending', name: '待付款', icon: '/assets/icons/icon-pending-payment.png', badge: 0 },
      { status: 'shipped', name: '待发货', icon: '/assets/icons/icon-pending-shipping.png', badge: 0 },
      { status: 'delivering', name: '待收货', icon: '/assets/icons/icon-pending-receive.png', badge: 0 },
      { status: 'completed', name: '待评价', icon: '/assets/icons/icon-pending-review.png', badge: 0 },
      { status: 'aftersale', name: '售后', icon: '/assets/icons/icon-aftersale.png', badge: 0 }
    ],
    menuItems: [
      { id: 1, name: '我的收藏', icon: '/assets/icons/icon-favorite.png' },
      { id: 2, name: '收货地址', icon: '/assets/icons/icon-address.png' },
      { id: 3, name: '优惠券', icon: '/assets/icons/icon-coupon.png' },
      { id: 4, name: '联系客服', icon: '/assets/icons/icon-customer-service.png' },
      { id: 5, name: '关于我们', icon: '/assets/icons/icon-about.png' },
      { id: 6, name: '设置', icon: '/assets/icons/icon-settings.png' }
    ],

    // 地址表单
    showAddressForm: false,
    addressFormData: {},

    // 全部订单
    orderList: [],
    orderListPage: 1,
    orderListHasMore: false,
    orderListLoading: false,
    orderListStatus: '',

    // 订单详情
    orderDetail: null,
    orderDetailLoading: false,
  },

  // ========== 生命周期 ==========
  onLoad() {
    this.loadHomeData()
    this.loadAvatarUrl()
  },

  async onPullDownRefresh() {
    const page = this.data.currentPage
    if (page === 0) {
      await this.loadHomeData()
    } else if (page === 1) {
      await this.ensureCategoryLoaded()
    } else if (page === 3) {
      await this.loadCartData()
    } else if (page === 4) {
      await this.loadAddressData()
    } else if (page === 7) {
      await this.loadProfileData()
    } else if (page === 8) {
      await this.loadOrderList(this.data.orderListStatus)
    }
    wx.stopPullDownRefresh()
  },

  async onRefreshHome() {
    this.setData({ refreshingHome: true })
    await this.loadHomeData()
    this.setData({ refreshingHome: false })
  },

  async loadAvatarUrl() {
    const url = app.fixCloudFileId(this.data.userInfo.avatar)
    if (!url || !url.startsWith('cloud://')) return
    try {
      const urlMapData = await app.callCloud('getTempURL', { fileList: [url] })
      if (urlMapData && urlMapData[url]) {
        this.setData({ 'userInfo.avatar': urlMapData[url] })
      } else {
        this.setData({ 'userInfo.avatar': '' })
      }
    } catch (e) {
      this.setData({ 'userInfo.avatar': '' })
    }
  },

  onShow() {
    this.refreshCartBadge();
  },

  // ========== 加载首页数据 ==========
  async loadHomeData() {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const [banners, categories, hotProducts, featuredProducts] = await Promise.all([
        app.callCloud('banners', { action: 'list' }),
        app.callCloud('categories', { action: 'list' }),
        app.callCloud('products', { action: 'list', data: { is_hot: '1', page_size: 10 } }),
        app.callCloud('products', { action: 'list', data: { is_featured: '1', page_size: 10 } })
      ]);

      const banner1 = banners.find(b => b.type === 'home');
      const banner2 = banners.find(b => b.type === 'promo');

      const bannerImage = banner1 ? (banner1.backgroundImage || banner1.image_url || '') : '';
      const secondBannerImage = banner2 ? (banner2.backgroundImage || banner2.image_url || '') : '';

      const hotList = hotProducts.list || []
      const featuredList = featuredProducts.list || []
      
      const allCloudImages = [bannerImage, secondBannerImage]
      categories.forEach(c => { if (c.image) allCloudImages.push(c.image); })
      hotList.forEach(p => { if (p.image) allCloudImages.push(p.image); })
      featuredList.forEach(p => { if (p.image) allCloudImages.push(p.image); })
      
      console.log('[DEBUG] 分类原始数据:', JSON.stringify(categories.map(c => ({ name: c.name, image: c.image }))))
      console.log('[DEBUG] banners原始image:', bannerImage, secondBannerImage)
      console.log('[DEBUG] 所有原始cloud图片:', allCloudImages)
      
      const uniqueCloudImages = [...new Set(allCloudImages.filter(url => url && (url.startsWith('cloud://') || url.startsWith('coud://'))).map(url => app.fixCloudFileId(url)))]
      console.log('[DEBUG] 修正后的去重图片ID:', uniqueCloudImages)
      
      const urlMap = {};
      
      if (uniqueCloudImages.length > 0) {
        const batchSize = 10;
        for (let i = 0; i < uniqueCloudImages.length; i += batchSize) {
          const batch = uniqueCloudImages.slice(i, i + batchSize);
          try {
            const urlMapData = await app.callCloud('getTempURL', { fileList: batch })
            console.log('[DEBUG] getTempURL云函数返回:', JSON.stringify(urlMapData))
            if (urlMapData) {
              Object.keys(urlMapData).forEach(fileId => {
                urlMap[fileId] = urlMapData[fileId] || ''
              })
            }
          } catch (e) {
            console.error('[DEBUG] 批量获取图片URL失败:', e)
          }
        }
      }
      console.log('[DEBUG] urlMap:', JSON.stringify(urlMap))

      const convertUrl = (url) => {
        if (!url) return ''
        const fixed = app.fixCloudFileId(url)
        return urlMap[fixed] || ''
      };

      this.setData({
        loading: false,
        bannerImage: convertUrl(bannerImage),
        secondBannerImage: convertUrl(secondBannerImage),
        homeCategories: categories.map(c => ({
  id: c._id, name: c.name, icon: c.icon, image: convertUrl(c.image), image_cloud: c.image || '', bgColor: c.bg_color
})),
        hotProducts: hotList.map(p => ({ ...this.formatProduct(p), image: convertUrl(p.image) })),
        featuredProducts: featuredList.map(p => ({ ...this.formatProduct(p), image: convertUrl(p.image) })),
        categoryList: ['全部商品', ...categories.map(c => c.name)],
        categoryAllProducts: [],
        recommendProducts: featuredList.slice(0, 4).map(p => ({
          id: p._id, name: p.name, price: p.price.toFixed(2), image: convertUrl(p.image || ''), image_cloud: p.image_cloud || '', emoji: p.emoji, bgColor: p.bg_color
        }))
      });
      
      wx.hideLoading()
    } catch (err) {
      console.error('加载首页数据失败:', err);
      wx.hideLoading()
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // ========== 格式化商品数据 ==========
  formatProduct(p) {
    return {
      id: p._id,
      name: p.name,
      desc: p.short_desc,
      price: p.price.toFixed(2),
      originalPrice: p.original_price ? p.original_price.toFixed(2) : '',
      sales: p.sales,
      image: p.image || '',
      image_cloud: p.image_cloud || '',
      emoji: p.emoji,
      bgColor: p.bg_color,
      tags: p.tags || [],
      isHot: p.is_hot,
      isFeatured: p.is_featured,
      detailDesc: p.detail_desc,
      categoryName: p.category_name
    }
  },

  // ========== 刷新购物车角标 ==========
  async refreshCartBadge() {
    try {
      const items = await app.callCloud('cart', { action: 'list' })
      const count = items.reduce((sum, i) => sum + (i.selected ? i.quantity : 0), 0)
      const tabs = [...this.data.homeNavTabs]
      const cartTab = tabs.find(t => t.label === '购物车')
      if (cartTab) cartTab.badge = count
      this.setData({ homeNavTabs: tabs })
    } catch (e) {
      // 未登录时忽略
    }
  },

  // ========== 导航辅助方法 ==========
  navigateTo(index) {
    const pageHistory = [...this.data.pageHistory];
    const currentPage = this.data.currentPage;
    if (currentPage !== index) {
      pageHistory.push(currentPage);
    }
    const navTabs = this.data.homeNavTabs;
    const navIndex = navTabs.findIndex(tab => tab.pageIndex === index);

    // 进入特定页面前加载数据
    if (index === 1) {
      this.ensureCategoryLoaded()
    }
    if (index === 3) this.loadCartData();
    if (index === 4) this.loadAddressData();
    if (index === 5) this.loadAvailableCoupons();
    if (index === 7) this.loadProfileData();

    this.setData({
      currentPage: index,
      currentNavTab: navIndex >= 0 ? navIndex : this.data.currentNavTab,
      pageHistory: pageHistory,
      pageTransition: 'fade'
    });
    setTimeout(() => {
      this.setData({ pageTransition: '' });
    }, 300);
  },

  goBack() {
    this.setData({ currentPage: 0, currentNavTab: 0, pageHistory: [] });
    setTimeout(() => {
      this.setData({ pageTransition: '' });
    }, 300);
  },

  onPageScroll(e) {
    const key = 'page_' + this.data.currentPage;
    const pageScrollTop = { ...this.data.pageScrollTop };
    pageScrollTop[key] = e.scrollTop;
    this.setData({ pageScrollTop: pageScrollTop });
  },

  // ========== 工具方法 ==========
  onImageError(e) {
    const rawUrl = e.currentTarget.dataset.cloud
    if (!rawUrl) return
    
    const cloudUrl = app.fixCloudFileId(rawUrl)
    
    if (cloudUrl.startsWith('cloud://')) {
      app.callCloud('getTempURL', { fileList: [cloudUrl] }).then(urlMapData => {
        const url = urlMapData && urlMapData[cloudUrl]
        if (url) {
          const key = e.currentTarget.dataset.key
          const idx = e.currentTarget.dataset.idx
          if (idx !== undefined) {
            this.setData({ [`${key}[${idx}]`]: url })
          } else if (key) {
            this.setData({ [key]: url })
          }
        } else {
          this._clearImageKey(e)
        }
      }).catch(() => {
        this._clearImageKey(e)
      })
    } else {
      this._clearImageKey(e)
    }
  },

  _clearImageKey(e) {
    const key = e.currentTarget.dataset.key
    const idx = e.currentTarget.dataset.idx
    if (idx !== undefined) {
      this.setData({ [`${key}[${idx}]`]: '' })
    } else if (key) {
      this.setData({ [key]: '' })
    }
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
  },

  onSearch() {
    const keyword = this.data.searchKeyword.trim();
    if (!keyword) return;
    wx.navigateTo({ url: '/pages/search/search?keyword=' + encodeURIComponent(keyword) });
  },

  // ========== 页面切换 ==========
  switchPage(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    this.navigateTo(index);
  },

  // ========== 底部导航切换 ==========
  onNavTabTap(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    const tab = this.data.homeNavTabs[index];
    this.setData({ currentNavTab: index });
    if (tab.pageIndex >= 0) {
      this.navigateTo(tab.pageIndex);
      if (tab.pageIndex === 1) {
        this.ensureCategoryLoaded()
      } else if (tab.pageIndex === 10) {
        this.loadDiscoverData()
      }
    }
  },

  // ========== 首页事件 ==========
  onCategoryTap(e) {
    const id = e.currentTarget.dataset.id;
    this._skipCategoryLoad = true
    this.navigateTo(1);
    const catIndex = this.data.homeCategories.findIndex(c => c.id === id);
    if (catIndex >= 0) {
      this.setData({ selectedCategory: catIndex + 1 });
      this.loadCategoryProducts(id);
    }
    this._skipCategoryLoad = false
  },

  onProductTap(e) {
    const id = e.currentTarget.dataset.id
    if (id) {
      this.loadProductDetail(id)
    }
  },

  // ========== 发现页面 ==========
  async loadDiscoverData() {
    if (this.data.discoverFeatured.length > 0) return
    this.setData({ discoverLoading: true })
    try {
      const [hotRes, featuredRes] = await Promise.all([
        app.callCloud('products', { action: 'hot', data: { limit: 8 } }).catch(() => []),
        app.callCloud('products', { action: 'featured', data: { limit: 8 } }).catch(() => [])
      ])
      this.setData({
        discoverFeatured: Array.isArray(hotRes) ? hotRes : [],
        discoverNewArrivals: Array.isArray(featuredRes) ? featuredRes : [],
        discoverLoading: false
      })
    } catch (e) {
      this.setData({ discoverLoading: false })
    }
  },

  onDiscoverProductTap(e) {
    const id = e.currentTarget.dataset.id
    if (id) this.loadProductDetail(id)
  },

  // ========== 加载商品详情 ==========
  async loadProductDetail(id) {
    try {
      wx.showLoading({ title: '加载中...' })
      
      const product = await app.callCloud('products', { action: 'detail', data: { id } })
      
      let imageUrl = app.fixCloudFileId(product.image || '')
      if (imageUrl && imageUrl.startsWith('cloud://')) {
        try {
          const urlMapData = await app.callCloud('getTempURL', { fileList: [imageUrl] })
          if (urlMapData && urlMapData[imageUrl]) {
            imageUrl = urlMapData[imageUrl]
          } else {
            imageUrl = ''
          }
        } catch (e) {
          console.error('转换详情图片URL失败:', e)
          imageUrl = ''
        }
      }
      
      let isFavorite = false
      try {
        const favResult = await app.callCloud('favorites', { action: 'check', data: { productId: product._id } })
        isFavorite = favResult.isFavorite
      } catch (e) {}
      
      this.setData({
        curProductId: product._id,
        productDetail: {
          id: product._id,
          name: product.name,
          price: product.price.toFixed(2),
          originalPrice: product.original_price ? product.original_price.toFixed(2) : '',
          sales: product.sales,
          stock: product.stock || 0,
          quantity: 1,
          isFavorite: isFavorite,
          images: [imageUrl, imageUrl, imageUrl],
          imageCloud: product.image_cloud || product.image || '',
          emoji: product.emoji,
          bgColor: product.bg_color,
          tags: product.tags || [],
          description: product.detail_desc || product.short_desc || ''
        }
      })
      
      wx.hideLoading()
      this.navigateTo(2)
    } catch (err) {
      wx.hideLoading()
      console.error('加载商品详情失败', err)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  // ========== 分类页面事件 ==========
  async onSelectCategory(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ selectedCategory: index })

    if (index === 0) {
      await this.loadCategoryProducts(null)
    } else {
      await this.loadCategoryProducts(this.data.homeCategories[index - 1]?.id)
    }
  },

  async loadCategoryProducts(categoryId, isLoadMore) {
    try {
      if (isLoadMore) {
        if (!this.data.categoryHasMore || this.data.categoryLoading) return
      } else {
        this.setData({ categoryLoading: true, categoryEmpty: false, categoryPage: 1, categoryHasMore: false })
      }
      
      const page = isLoadMore ? this.data.categoryPage + 1 : 1
      const params = { page, page_size: 10 }
      if (categoryId) params.category_id = categoryId
      
      const res = await app.callCloud('products', { action: 'list', data: params })
      const rawProducts = res.list || []
      
      const cloudImages = rawProducts.map(p => p.image).filter(url => url && (url.startsWith('cloud://') || url.startsWith('coud://')))
      const urlMap = {}
      
      if (cloudImages.length > 0) {
        const uniqueIds = [...new Set(cloudImages.map(url => app.fixCloudFileId(url)))]
        try {
          const urlMapData = await app.callCloud('getTempURL', { fileList: uniqueIds })
          if (urlMapData) {
            Object.keys(urlMapData).forEach(fileId => {
              urlMap[fileId] = urlMapData[fileId] || ''
            })
          }
        } catch (e) {
          console.error('转换分类图片URL失败:', e)
        }
      }
      
      const products = rawProducts.map(p => ({
        id: p._id, 
        name: p.name, 
        desc: p.short_desc, 
        price: p.price.toFixed(2),
        originalPrice: p.original_price ? p.original_price.toFixed(2) : '',
        sales: p.sales,
        stock: p.stock || 0,
        image: urlMap[app.fixCloudFileId(p.image)] || '',
        image_cloud: p.image_cloud || '',
        emoji: p.emoji, 
        bgColor: p.bg_color,
        status: p.status !== undefined ? p.status : 1
      }))
      
      const totalPages = res.totalPages || Math.ceil((res.total || 0) / 10)
      const hasMore = page < totalPages
      
      const dataToSet = {
        categoryLoading: false,
        categoryPage: page,
        categoryHasMore: hasMore,
        categoryEmpty: isLoadMore ? false : products.length === 0
      }
      dataToSet.categoryProducts = isLoadMore
        ? [...this.data.categoryProducts, ...products]
        : products
      if (!categoryId && !isLoadMore) dataToSet.categoryAllProducts = products
      this.setData(dataToSet)
    } catch (e) {
      this.setData({ categoryLoading: false })
      console.error('加载分类商品失败', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onLoadMoreCategory() {
    const catId = this.data.selectedCategory > 0
      ? this.data.homeCategories[this.data.selectedCategory - 1]?.id
      : null
    this.loadCategoryProducts(catId, true)
  },

  ensureCategoryLoaded() {
    if (this._skipCategoryLoad) return
    if (this.data.categoryAllProducts.length > 0) return
    if (this._loadingCategory) return
    this._loadingCategory = true
    this.setData({ selectedCategory: 0 })
    this.loadCategoryProducts(null).finally(() => {
      this._loadingCategory = false
    })
  },

  // ========== 添加到购物车（从分类页） ==========
  async onAddCart(e) {
    const id = e.currentTarget.dataset.id
    const product = this.data.categoryProducts.find(p => p.id === id)
    
    if (!product) {
      wx.showToast({ title: '商品信息不存在', icon: 'none' })
      return
    }
    
    if (product.status === 0) {
      wx.showToast({ title: '商品已下架', icon: 'none' })
      return
    }
    
    if (product.stock <= 0) {
      wx.showToast({ title: '商品库存不足', icon: 'none' })
      return
    }
    
    try {
      await app.callCloud('cart', { action: 'add', data: { product_id: id, quantity: 1 } })
      wx.showToast({ title: '已添加购物车', icon: 'success', duration: 1500 })
      this.refreshCartBadge()
    } catch (err) {
      console.error('添加购物车失败:', err)
      wx.showToast({ title: err.message || '添加失败', icon: 'none' })
    }
  },

  // ========== 商品详情事件 ==========
  onDecreaseQuantity() {
    const detail = this.data.productDetail;
    if (!detail) return;
    if (detail.quantity > 1) {
      this.setData({ 'productDetail.quantity': detail.quantity - 1 });
    }
  },

  onIncreaseQuantity() {
    const detail = this.data.productDetail;
    if (!detail) return;
    if (detail.quantity < detail.stock) {
      this.setData({ 'productDetail.quantity': detail.quantity + 1 });
    }
  },

  async onToggleFavorite() {
    const detail = this.data.productDetail;
    if (!detail) return;
    try {
      const result = await app.callCloud('favorites', { action: 'toggle', data: { productId: detail.id } });
      this.setData({ 'productDetail.isFavorite': result.isFavorite });
      wx.showToast({
        title: result.isFavorite ? '已收藏' : '取消收藏',
        icon: 'success', duration: 1000
      });
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  async onAddToCart() {
    const detail = this.data.productDetail;
    if (!detail) return;
    try {
      await app.callCloud('cart', { action: 'add', data: { product_id: detail.id, quantity: detail.quantity } });
      wx.showToast({ title: '已加入购物车', icon: 'success', duration: 1500 });
      this.refreshCartBadge();
    } catch (err) {
      wx.showToast({ title: '添加失败', icon: 'none' });
    }
  },

  onBuyNow() {
    const detail = this.data.productDetail;
    if (!detail) return;
    app.callCloud('cart', { action: 'add', data: { product_id: detail.id, quantity: detail.quantity } }).then(() => {
      this.refreshCartBadge();
    }).catch(() => {});
    this.navigateTo(4);
  },

  onDetailCustomerService() {
    wx.showToast({ title: '客服功能开发中', icon: 'none' });
  },

  onPreviewImage(e) {
    const current = e.currentTarget.dataset.src
    const images = this.data.productDetail?.images || []
    if (current && images.length > 0) {
      wx.previewImage({ current, urls: images })
    }
  },

  // ========== 购物车事件 ==========
  async loadCartData() {
    try {
      const items = await app.callCloud('cart', { action: 'list' })
      
      const cloudImages = items.map(item => (item.product || {}).image).filter(url => url && (url.startsWith('cloud://') || url.startsWith('coud://')))
      const urlMap = {}
      
      if (cloudImages.length > 0) {
        const uniqueIds = [...new Set(cloudImages.map(url => app.fixCloudFileId(url)))]
        try {
          const urlMapData = await app.callCloud('getTempURL', { fileList: uniqueIds })
          if (urlMapData) {
            Object.keys(urlMapData).forEach(fileId => {
              urlMap[fileId] = urlMapData[fileId] || ''
            })
          }
        } catch (e) {
          console.error('转换购物车图片URL失败:', e)
        }
      }
      
      const cartItems = items.map(item => {
        const product = item.product || {}
        return {
          id: item._id,
          productId: item.product_id,
          name: product.name || item.product_name || '未知商品',
          spec: product.spec || '',
          price: product.price || item.price,
          quantity: item.quantity,
          selected: item.selected,
          image: urlMap[app.fixCloudFileId(product.image)] || '',
          image_cloud: product.image_cloud || '',
          emoji: product.emoji,
          bgColor: product.bg_color,
          stock: item.stock || 0,
          available: item.available !== false
        }
      })
      
      this.setData({ cartItems })
      this.calculateTotal()
    } catch (e) {
      console.error('加载购物车失败', e)
    }
  },

  onToggleEdit() {
    this.setData({ isEditCart: !this.data.isEditCart });
  },

  async onDeleteCartItems() {
    const selectedItems = this.data.cartItems.filter(item => item.selected)
    if (selectedItems.length === 0) {
      wx.showToast({ title: '请选择要删除的商品', icon: 'none' })
      return
    }
    wx.showModal({
      title: '确认删除',
      content: `确定删除选中的 ${selectedItems.length} 件商品吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            await app.callCloud('cart', {
              action: 'batchDelete',
              data: { ids: selectedItems.map(item => item.id) }
            })
            wx.showToast({ title: '删除成功', icon: 'success' })
            this.loadCartData()
            this.refreshCartBadge()
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  async onToggleCartItem(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.cartItems[index]
    if (!item) return
    try {
      await app.callCloud('cart', { action: 'update', data: { id: item.id, selected: !item.selected } })
      const cartItems = [...this.data.cartItems]
      cartItems[index].selected = !cartItems[index].selected
      this.setData({ cartItems })
      this.calculateTotal()
    } catch (e) {}
  },

  async onToggleSelectAll() {
    const newSelectAll = !this.data.isSelectAll
    try {
      await app.callCloud('cart', { action: 'select_all', data: { selected: newSelectAll } })
      const cartItems = this.data.cartItems.map(item => ({ ...item, selected: newSelectAll }))
      this.setData({ cartItems, isSelectAll: newSelectAll })
      this.calculateTotal()
    } catch (e) {}
  },

  async onCartDecrease(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.cartItems[index]
    if (!item || item.quantity <= 1) return
    try {
      await app.callCloud('cart', { action: 'update', data: { id: item.id, quantity: item.quantity - 1 } })
      const cartItems = [...this.data.cartItems]
      cartItems[index].quantity -= 1
      this.setData({ cartItems })
      this.calculateTotal()
    } catch (e) {}
  },

  async onCartIncrease(e) {
    const index = e.currentTarget.dataset.index
    const item = this.data.cartItems[index]
    if (!item) return
    try {
      await app.callCloud('cart', { action: 'update', data: { id: item.id, quantity: item.quantity + 1 } })
      const cartItems = [...this.data.cartItems]
      cartItems[index].quantity += 1
      this.setData({ cartItems })
      this.calculateTotal()
    } catch (e) {}
  },

  calculateTotal() {
    let total = 0;
    let count = 0;
    this.data.cartItems.forEach(item => {
      if (item.selected) {
        total += item.price * item.quantity;
        count += item.quantity;
      }
    });
    this.setData({
      totalPrice: total,
      selectedCount: count,
      isSelectAll: this.data.cartItems.length > 0 && this.data.cartItems.every(item => item.selected)
    });
  },

  onCheckout() {
    // 设置 checkoutItems
    const selected = this.data.cartItems.filter(item => item.selected);
    if (selected.length === 0) {
      wx.showToast({ title: '请选择商品', icon: 'none' });
      return;
    }
    this.setData({
      checkoutItems: selected.map(item => ({
        id: item.productId,
        name: item.name,
        price: item.price.toFixed(2),
        quantity: item.quantity,
        image: item.image,
        image_cloud: item.image_cloud || '',
        emoji: item.emoji,
        bgColor: item.bgColor
      })),
      checkoutTotal: this.data.totalPrice.toFixed(2),
      addressFromCheckout: true
    });
    this.navigateTo(4);
  },

  // ========== 地址事件 ==========
  onCheckoutAddressTap() {
    this.setData({ addressFromCheckout: true })
    this.navigateTo(4)
  },

  async loadAddressData() {
    try {
      const addresses = await app.callCloud('addresses', { action: 'list' })
      const defaultIndex = addresses.findIndex(a => a.is_default)
      this.setData({
        addressList: addresses,
        selectedAddressIndex: defaultIndex >= 0 ? defaultIndex : (addresses.length > 0 ? 0 : -1),
        checkoutAddress: addresses.length > 0 ? addresses[defaultIndex >= 0 ? defaultIndex : 0] : null
      })
    } catch (e) {
      console.error('加载地址失败')
    }
  },

  onSelectAddress(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      selectedAddressIndex: index,
      checkoutAddress: this.data.addressList[index]
    });
  },

  // ========== 支付订单事件 ==========
  onSelectPayment(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({ selectedPayment: method });
  },

  async onSubmitOrder() {
    if (!this.data.checkoutAddress) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' })
      return
    }
    wx.showLoading({ title: '正在提交...' })
    try {
      const selectedCartIds = this.data.cartItems.filter(item => item.selected).map(item => item.id)
      const selectedCoupon = this.data.selectedCoupon
      const discountAmount = selectedCoupon ? selectedCoupon.value : 0
      const payAmount = parseFloat(this.data.checkoutPayAmount || this.data.checkoutTotal)

      const result = await app.callCloud('orders', {
        action: 'create',
        data: {
          items: this.data.checkoutItems,
          address: this.data.checkoutAddress,
          total_amount: this.data.totalPrice,
          pay_amount: payAmount,
          coupon_id: selectedCoupon ? (selectedCoupon.couponId || selectedCoupon._id) : null,
          discount_amount: discountAmount
        }
      })

      // 使用优惠券
      if (selectedCoupon && selectedCoupon._id) {
        try {
          await app.callCloud('coupons', {
            action: 'use',
            data: { userCouponId: selectedCoupon._id, orderId: result.id }
          })
        } catch (couponErr) {
          console.error('使用优惠券失败:', couponErr)
        }
      }

      // 模拟支付：下单后自动支付
      try {
        await app.callCloud('orders', { action: 'pay', data: { id: result.id } })
      } catch (payErr) {
        console.error('模拟支付失败:', payErr)
      }
      
      if (selectedCartIds.length > 0) {
        app.callCloud('cart', { action: 'batchDelete', data: { ids: selectedCartIds } }).catch(() => {})
      }
      
      wx.hideLoading()
      this.setData({ orderNo: result.order_no })
      this.refreshCartBadge()
      this.navigateTo(6)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '提交失败', icon: 'none' })
    }
  },

  // ========== 支付成功事件 ==========
  onViewOrder() {
    this.navigateTo(8)
    setTimeout(() => this.loadOrderList('paid'), 300)
  },

  // ========== 个人中心事件 ==========
  async loadProfileData() {
    try {
      const [user, orderStats, favCount, couponCount] = await Promise.all([
        app.callCloud('login'),
        app.callCloud('stats', { action: 'order_status_counts', data: {} }).catch(() => null),
        app.callCloud('favorites', { action: 'list', data: { page: 1, pageSize: 1 } }).catch(() => ({ total: 0 })),
        app.callCloud('coupons', { action: 'myCoupons', data: { status: 'unused' } }).catch(() => ([]))
      ])
      
      const avatarCloud = user.avatar || 'cloud://cloud1-d2ga1cyam2db88c94.636c-cloud1-d2ga1cyam2db88c94-1436162449/cloud-images/avatar.png'
      let avatar = ''
      if (avatarCloud) {
        avatar = await app.getImageUrl(avatarCloud)
      }
      this.setData({
        userInfo: {
          nickname: user.nickname || '微信用户',
          avatar: avatar,
          avatarCloud: avatarCloud,
          welcome: '欢迎来到乌东苗寨小卖部'
        },
        profileFavCount: favCount.total || 0,
        profileCouponCount: Array.isArray(couponCount) ? couponCount.length : 0
      });

      if (orderStats && orderStats.counts) {
        const statusItems = [...this.data.orderStatusItems]
        const statusMap = { pending: 'pending', shipped: 'shipped', delivering: 'delivering', completed: 'completed', aftersale: 'aftersale' }
        for (let i = 0; i < statusItems.length; i++) {
          const key = statusMap[statusItems[i].status]
          statusItems[i].badge = orderStats.counts[key] || 0
        }
        this.setData({ orderStatusItems: statusItems })
      }
    } catch (e) {
      console.error('加载用户信息失败');
    }
  },

  onOrderStatusTap(e) {
    const status = e.currentTarget.dataset.status
    this.navigateTo(8)
    this.loadOrderList(status)
  },

  onMenuTap(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.menuItems[index];
    if (!item) return;
    if (item.id === 1) {
      wx.navigateTo({ url: '/pages/favorites/favorites' });
    } else if (item.id === 2) {
      this.setData({ addressFromCheckout: false })
      this.navigateTo(4);
    } else if (item.id === 3) {
      wx.navigateTo({ url: '/pages/coupons/coupons' });
    } else if (item.id === 4) {
      wx.showToast({ title: '客服功能开发中', icon: 'none' });
    } else if (item.id === 5) {
      wx.showToast({ title: '关于我们', icon: 'none' });
    } else if (item.id === 6) {
      wx.showToast({ title: '设置', icon: 'none' });
    }
  },

  // ========== 优惠券选择 ==========
  async loadAvailableCoupons() {
    if (this.data.currentPage !== 5) return
    try {
      const coupons = await app.callCloud('coupons', { action: 'myCoupons', data: { status: 'unused' } })
      this.setData({ myAvailableCoupons: Array.isArray(coupons) ? coupons : [] })
    } catch (e) {
      this.setData({ myAvailableCoupons: [] })
    }
  },

  onSelectCheckoutCoupon(e) {
    const idx = e.currentTarget.dataset.index
    const coupons = this.data.myAvailableCoupons
    if (idx >= 0 && idx < coupons.length) {
      const coupon = coupons[idx]
      const total = parseFloat(this.data.checkoutTotal)
      if (total >= coupon.minAmount) {
        const payAmount = Math.max(0, total - coupon.value)
        this.setData({
          selectedCoupon: coupon,
          checkoutPayAmount: payAmount.toFixed(2),
          showCouponPicker: false
        })
      } else {
        wx.showToast({ title: `满${coupon.minAmount}元可用`, icon: 'none' })
      }
    }
  },

  onRemoveSelectedCoupon() {
    this.setData({ selectedCoupon: null, checkoutPayAmount: this.data.checkoutTotal })
  },

  onToggleCouponPicker() {
    this.setData({ showCouponPicker: !this.data.showCouponPicker })
  },

  // ========== 地址选择→去支付 ==========
  onProceedToCheckout() {
    if (this.data.selectedAddressIndex < 0) {
      wx.showToast({ title: '请选择收货地址', icon: 'none' })
      return
    }
    this.setData({ selectedCoupon: null, showCouponPicker: false, checkoutPayAmount: this.data.checkoutTotal })
    this.navigateTo(5)
  },

  // ========== 地址表单管理 ==========
  onAddAddress() {
    this.setData({
      showAddressForm: true,
      addressFormData: { name: '', phone: '', province: '', city: '', district: '', detail: '', is_default: false }
    })
  },

  onEditAddress(e) {
    const index = e.currentTarget.dataset.index
    const addr = this.data.addressList[index]
    if (!addr) return
    this.setData({
      showAddressForm: true,
      addressFormData: { id: addr._id, name: addr.name, phone: addr.phone, province: addr.province, city: addr.city, district: addr.district, detail: addr.detail, is_default: !!addr.is_default }
    })
  },

  onCancelAddressForm() {
    this.setData({ showAddressForm: false, addressFormData: {} })
  },

  onAddressFormInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({ ['addressFormData.' + field]: value })
  },

  onToggleAddressDefault() {
    this.setData({ ['addressFormData.is_default']: !this.data.addressFormData.is_default })
  },

  async onSaveAddress() {
    const form = this.data.addressFormData
    if (!form.name || !form.phone || !form.province || !form.city || !form.district || !form.detail) {
      wx.showToast({ title: '请完整填写地址信息', icon: 'none' })
      return
    }
    if (!/^1\d{10}$/.test(form.phone)) {
      wx.showToast({ title: '手机号格式不正确', icon: 'none' })
      return
    }
    wx.showLoading({ title: '保存中...' })
    try {
      if (form.id) {
        await app.callCloud('addresses', { action: 'update', data: form })
      } else {
        await app.callCloud('addresses', { action: 'add', data: { name: form.name, phone: form.phone, province: form.province, city: form.city, district: form.district, detail: form.detail, is_default: form.is_default } })
      }
      wx.hideLoading()
      wx.showToast({ title: '保存成功', icon: 'success' })
      this.setData({ showAddressForm: false, addressFormData: {} })
      this.loadAddressData()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '保存失败', icon: 'none' })
    }
  },

  async onDeleteAddress() {
    const form = this.data.addressFormData
    if (!form.id) return
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个地址吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await app.callCloud('addresses', { action: 'delete', data: { id: form.id } })
            wx.showToast({ title: '已删除', icon: 'success' })
            this.setData({ showAddressForm: false, addressFormData: {} })
            this.loadAddressData()
          } catch (err) {
            wx.showToast({ title: err.message || '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  // ========== 全部订单 ==========
  onViewAllOrders() {
    this.navigateTo(8)
    this.loadOrderList('')
  },

  onViewOrdersByStatus(e) {
    const status = e.currentTarget.dataset.status
    this.setData({ orderList: [], orderListPage: 1, orderListHasMore: false })
    this.navigateTo(8)
    this.loadOrderList(status)
  },

  onBackFromOrders() {
    this.goBack()
  },

  async loadOrderList(status, isLoadMore) {
    if (isLoadMore) {
      if (!this.data.orderListHasMore || this.data.orderListLoading) return
    } else {
      this.setData({ orderListLoading: true, orderListStatus: status || '', orderListPage: 1, orderListHasMore: false })
    }
    try {
      const page = isLoadMore ? this.data.orderListPage + 1 : 1
      const params = { page, page_size: 10 }
      if (status) params.status = status
      const res = await app.callCloud('orders', { action: 'list', data: params })
      const orders = res.list || []
      const totalPages = res.totalPages || Math.ceil((res.total || 0) / 10)
      const hasMore = page < totalPages
      this.setData({
        orderList: isLoadMore ? [...this.data.orderList, ...orders] : orders,
        orderListPage: page,
        orderListHasMore: hasMore,
        orderListLoading: false
      })
    } catch (err) {
      this.setData({ orderListLoading: false })
      wx.showToast({ title: '加载订单失败', icon: 'none' })
    }
  },

  onLoadMoreOrders() {
    this.loadOrderList(this.data.orderListStatus, true)
  },

  onFilterOrders(e) {
    const status = e.currentTarget.dataset.status
    this.setData({ orderList: [], orderListPage: 1, orderListHasMore: false })
    this.loadOrderList(status)
  },

  async onCancelOrder(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({
      title: '取消订单',
      content: '确定要取消这个订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await app.callCloud('orders', { action: 'cancel', data: { id: orderId } })
            wx.showToast({ title: '订单已取消', icon: 'success' })
            this.loadOrderList(this.data.orderListStatus)
            this.loadProfileData()
          } catch (err) {
            wx.showToast({ title: err.message || '取消失败', icon: 'none' })
          }
        }
      }
    })
  },

  async onConfirmReceive(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认收货',
      content: '确认收到商品了吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await app.callCloud('orders', { action: 'confirm_receive', data: { id: orderId } })
            wx.showToast({ title: '确认收货成功', icon: 'success' })
            this.loadOrderList(this.data.orderListStatus)
            this.loadProfileData()
          } catch (err) {
            wx.showToast({ title: err.message || '操作失败', icon: 'none' })
          }
        }
      }
    })
  },

  async onPayOrder(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showLoading({ title: '处理中...' })
    try {
      await app.callCloud('orders', { action: 'pay', data: { id: orderId } })
      wx.hideLoading()
      wx.showToast({ title: '支付成功', icon: 'success' })
      this.loadOrderList(this.data.orderListStatus)
      this.loadProfileData()
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '支付失败', icon: 'none' })
    }
  },

  async onDeleteOrder(e) {
    const orderId = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除订单',
      content: '确定要删除这个订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await app.callCloud('orders', { action: 'delete', data: { id: orderId } })
            wx.showToast({ title: '已删除', icon: 'success' })
            this.goBack()
          } catch (err) {
            wx.showToast({ title: err.message || '删除失败', icon: 'none' })
          }
        }
      }
    })
  },

  // 从订单列表查看商品详情
  onOrderProductTap(e) {
    const productId = e.currentTarget.dataset.id
    if (productId) {
      this.loadProductDetail(productId)
    }
  },

  // ========== 订单详情 ==========
  onViewOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id || e.currentTarget.dataset.orderid
    if (!orderId) return
    this.loadOrderDetail(orderId)
  },

  async loadOrderDetail(orderId) {
    this.setData({ orderDetailLoading: true })
    try {
      const order = await app.callCloud('orders', { action: 'detail', data: { id: orderId } })
      
      const cloudImages = (order.items || []).map(item => item.image || '').filter(url => url && url.startsWith('cloud://'))
      const urlMap = {}
      if (cloudImages.length > 0) {
        try {
          const urlMapData = await app.callCloud('getTempURL', { fileList: [...new Set(cloudImages.map(url => app.fixCloudFileId(url)))] })
          if (urlMapData) {
            Object.keys(urlMapData).forEach(fileId => { urlMap[fileId] = urlMapData[fileId] || '' })
          }
        } catch (e) {}
      }
      
      const items = (order.items || []).map(item => ({
        ...item,
        image: urlMap[app.fixCloudFileId(item.image)] || item.image || ''
      }))

      this.setData({
        orderDetail: { ...order, items },
        orderDetailLoading: false
      })
      this.navigateTo(9)
    } catch (err) {
      this.setData({ orderDetailLoading: false })
      wx.showToast({ title: '加载订单详情失败', icon: 'none' })
    }
  }
});