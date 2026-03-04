// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

exports.main = async(event, context) => { 
  const wxContext = cloud.getWXContext()
  
  return {
    openid: wxContext.OPENID,  // 统一使用小写openid
    openId: wxContext.OPENID,  // 同时提供大写版本以兼容
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  }
}