# 数据库结构设计

## User 集合（基础信息表）
```javascript
{
  "_id": "user_001",
  "name": "张三",               // 真实姓名
  "phone": "12345678901",      // 手机号(登录密码)
  "gender": "男",              // 性别
  "school": "北京大学",         // 学校
  "order": 1,                  // 排序
  "free": true,                // 是否可用
  "grade": "大三",             // 年级
  "numericId": 1001,           // 数字ID(用户搜索用)
  "wechatAuth": {              // 新增：微信授权信息
    "nickname": "微信昵称",
    "avatarUrl": "微信头像URL",
    "authTime": "2026-02-07T10:00:00.000Z"
  }
}
```

## ActiveUser 集合（活跃用户表）
```javascript
{
  "_id": "active_001",
  "_openid": "test_openid_001",
  // 基础信息
  "name": "张三",
  "phone": "12345678901", 
  "gender": "男",
  "school": "北京大学",
  "numericId": 1001,           // 数字ID
  
  // Profile信息
  "profile": {
    "title": "先生",           // 称呼：先生/女士
    "signature": "热爱舞蹈的人", // 个性签名
    "avatar": "/images/avatar1.jpg", // 个人头像
    "isPublic": true,          // 是否对陌生人公开
    "completed": false         // 资料是否填写完整
  },
  
  // 舞伴相关
  "partner": {
    "hasPartner": false,       // 是否有舞伴
    "partnerName": "",         // 舞伴姓名
    "partnerNumericId": 0,     // 舞伴数字ID
    "allowRandomMatch": false, // 是否愿意随机分配
    "matchDdl": "2026-03-01T00:00:00.000Z" // 匹配截止时间
  },
  
  // 报名相关（新增）
  "registration": {
    "registered": false,       // 是否已报名
    "hasDiscount": false,      // 是否有折扣
    "discountProof": "",       // 集赞截图
    "discountStatus": "pending", // 审核状态: pending/approved/rejected
    "paymentStatus": "unpaid", // 支付状态: unpaid/paid/refunded
    "orderId": "",             // 订单号
    "paymentTime": null,       // 支付时间
    "qrCodeShown": false      // 是否已显示群二维码
  },
  
  // 系统设置
  "settings": {
    "language": "zh",          // 语言设置
    "canedit": true,           // 是否可编辑
    "lastLoginTime": "2026-02-07T10:00:00.000Z"
  },
  
  // 原有字段
  "order": 1,
  "free": true,
  "grade": "大三",
  "receive": {},
  "send": {},
  "love": "拉丁舞",
  "message": "个人介绍",
  "nickname": "用户昵称",
  "image": "/images/default.jpg"
}
```

## Invitations 集合（邀请记录表）
```javascript
{
  "_id": "invite_001",
  "senderNumericId": 1001,     // 发送者数字ID
  "receiverNumericId": 1002,   // 接收者数字ID
  "senderid": "openid_001",    // 发送者OpenID  
  "receiverid": "openid_002",  // 接收者OpenID
  "sendername": "张三",        // 发送者姓名
  "receivername": "李四",      // 接收者姓名
  "message": "希望成为舞伴",    // 邀请消息
  "status": "pending",         // 状态：pending/accepted/rejected
  "type": "partner",           // 新增：邀请类型：partner/friend
  "createTime": "2026-02-07T10:00:00.000Z",
  "responseTime": null,
  "expiryTime": "2026-02-14T10:00:00.000Z" // 新增：邀请过期时间
}
```

## NumericIdCounter 集合（ID计数器）
```javascript
{
  "_id": "id_counter",
  "currentId": 1000,           // 当前最大ID
  "lastReset": "2026-01-01T00:00:00.000Z"
}
```

## RegistrationOrders 集合（报名订单表）
```javascript
{
  "_id": "order_001", 
  "orderId": "ORD202602071001",
  "userNumericId": 1001,
  "openid": "openid_001",
  "amount": 299,               // 订单金额(分)
  "discount": 50,              // 折扣金额(分)
  "finalAmount": 249,          // 实付金额(分)
  "status": "pending",         // pending/paid/cancelled/refunded
  "paymentMethod": "wechat",   // wechat/alipay/offline
  "transactionId": "",         // 支付交易号
  "createTime": "2026-02-07T10:00:00.000Z",
  "payTime": null,
  "cancelTime": null
}
```

## AdminSettings 集合（管理员设置）
```javascript
{
  "_id": "admin_settings",
  "registration": {
    "enabled": true,           // 是否开放报名
    "price": 299,              // 报名价格(分)
    "discountPrice": 249,      // 折扣价格(分)
    "deadline": "2026-03-01T00:00:00.000Z"
  },
  "matching": {
    "randomMatchEnabled": true, // 是否开启随机匹配
    "matchDeadline": "2026-02-20T00:00:00.000Z",
    "lastMatchTime": null
  },
  "wechatGroup": {
    "qrCodeUrl": "/images/group-qr.png", // 微信群二维码
    "groupName": "STARLET百老汇之夜参与群"
  }
}
```

这个新的数据库设计支持的功能：
- 数字ID系统
- 完整的Profile管理
- 隐私设置
- 舞伴配对和随机分配
- 报名和折扣系统
- 多语言支持
- 流程控制机制