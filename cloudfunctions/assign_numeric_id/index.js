// 云函数：分配数字ID
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  
  try {
    // 检查用户是否已经有数字ID
    const userResult = await db.collection('ActiveUser')
      .where({ _openid: wxContext.OPENID })
      .get()
    
    if (userResult.data.length > 0 && userResult.data[0].numericId) {
      return {
        success: true,
        numericId: userResult.data[0].numericId,
        message: '已存在数字ID'
      }
    }
    
    // 获取当前ID计数器
    let counterResult = await db.collection('NumericIdCounter')
      .doc('id_counter')
      .get()
    
    let currentId = 1000 // 默认起始ID
    
    if (counterResult.data) {
      currentId = counterResult.data.currentId + 1
    } else {
      // 初始化计数器
      await db.collection('NumericIdCounter').add({
        data: {
          _id: 'id_counter',
          currentId: 1000,
          lastReset: new Date()
        }
      })
      currentId = 1001
    }
    
    // 更新计数器
    await db.collection('NumericIdCounter')
      .doc('id_counter')
      .update({
        data: {
          currentId: currentId,
          lastUpdate: new Date()
        }
      })
    
    // 更新用户的数字ID
    if (userResult.data.length > 0) {
      await db.collection('ActiveUser')
        .doc(userResult.data[0]._id)
        .update({
          data: {
            numericId: currentId
          }
        })
    }
    
    return {
      success: true,
      numericId: currentId,
      message: '数字ID分配成功'
    }
    
  } catch (error) {
    console.error('分配数字ID失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}