const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
// 云函数入口函数
const db = cloud.database()
const _ = db.command
// 云函数访问数据库上限为100
const MAX_LIMIT = 100
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const listname = "ActiveUser"
  // 先取出集合记录总数
  const countResult = await db.collection(listname).count()
  const total = countResult.total
  // 计算需分几次取
  const batchTimes = Math.ceil(total / 100)
  // 承载所有读操作的 promise 的数组
  const tasks = []
  for (let i = 0; i < batchTimes; i++) {
    const promise = db.collection(listname).field({
      _id: true,
      _openid: true,
      name: true,
      nickname: true,
      gender: true,
      school: true,
      love: true,
      image: true,
      numericId: true,
      partner: true
    }).where({
      // 仅显式隐藏账号不出现在列表中
      'visibility.hiddenFromUsers': _.neq(true)
    }).skip(i * MAX_LIMIT).limit(MAX_LIMIT).get()
    tasks.push(promise)
  }
  // 等待所有
  return (await Promise.all(tasks)).reduce((acc, cur) => {
    return {
      data: acc.data.concat(cur.data),
      errMsg: "acc.errMsg",
      openid:wxContext.OPENID
    }
  })
}