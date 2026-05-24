const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

function fixCloudFileId(fileID) {
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
}

exports.main = async (event, context) => {
  const { fileList } = event
  
  if (!fileList || !Array.isArray(fileList) || fileList.length === 0) {
    return { code: 0, data: {} }
  }

  const fileIds = fileList.map(f => {
    if (typeof f === 'string') return f
    if (f && typeof f === 'object' && f.fileID) return f.fileID
    return null
  }).filter(Boolean)

  const fixedList = fileIds.map(fixCloudFileId).filter(id => id && id.startsWith('cloud://'))
  if (fixedList.length === 0) {
    return { code: 0, data: {} }
  }
  
  try {
    const result = await cloud.getTempFileURL({
      fileList: fixedList.slice(0, 50)
    })
    
    const urlMap = {}
    if (result.fileList && Array.isArray(result.fileList)) {
      result.fileList.forEach(item => {
        if (item.tempFileURL) {
          urlMap[item.fileID] = item.tempFileURL
        }
      })
    }
    
    return { code: 0, data: urlMap }
  } catch (err) {
    console.error('获取临时链接失败:', err)
    return { code: -1, message: err.message || '获取临时链接失败' }
  }
}
