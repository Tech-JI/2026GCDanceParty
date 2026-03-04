# 用户表测试数据 (User Collection)

```json
[
  {
    "_id": "user_001",
    "openid": "oTest-zhang-san-openid-001",
    "name": "张三",
    "phone": "13800138001",
    "email": "zhangsan@example.com",
    "gender": "male",
    "avatarUrl": "https://wx.qlogo.cn/mmhead/test/zhang/64",
    "free": true,
    "paymentProcessing": false,
    "paymentTime": "2026-02-15T10:30:00Z",
    "orderNumber": "ORDER20260215001",
    "paymentAmount": 199,
    "createTime": "2026-02-10T08:00:00Z",
    "updateTime": "2026-02-15T10:35:00Z"
  },
  {
    "_id": "user_002",
    "openid": "oTest-li-si-openid-002",
    "name": "李四",
    "phone": "13800138002",
    "email": "lisi@example.com",
    "gender": "female",
    "avatarUrl": "https://wx.qlogo.cn/mmhead/test/li/64",
    "free": false,
    "paymentProcessing": true,
    "paymentTime": "2026-02-20T14:20:00Z",
    "orderNumber": "ORDER20260220002",
    "paymentAmount": 199,
    "createTime": "2026-02-18T09:15:00Z",
    "updateTime": "2026-02-20T14:25:00Z"
  },
  {
    "_id": "user_003",
    "openid": "oTest-wang-wu-openid-003",
    "name": "王五",
    "phone": "13800138003",
    "email": "wangwu@example.com",
    "gender": "male",
    "avatarUrl": "https://wx.qlogo.cn/mmhead/test/wang/64",
    "free": false,
    "paymentProcessing": false,
    "paymentTime": null,
    "orderNumber": null,
    "paymentAmount": 0,
    "createTime": "2026-02-19T16:45:00Z",
    "updateTime": "2026-02-19T16:45:00Z"
  },
  {
    "_id": "user_004",
    "openid": "oTest-zhao-liu-openid-004",
    "name": "赵六",
    "phone": "13800138004",
    "email": "zhaoliu@example.com",
    "gender": "female",
    "avatarUrl": "https://wx.qlogo.cn/mmhead/test/zhao/64",
    "free": true,
    "paymentProcessing": false,
    "paymentTime": "2026-02-12T11:15:00Z",
    "orderNumber": "ORDER20260212003",
    "paymentAmount": 199,
    "createTime": "2026-02-08T13:20:00Z",
    "updateTime": "2026-02-12T11:20:00Z"
  },
  {
    "_id": "user_005",
    "openid": "oTest-sun-qi-openid-005",
    "name": "孙七",
    "phone": "13800138005",
    "email": "sunqi@example.com",
    "gender": "male",
    "avatarUrl": "https://wx.qlogo.cn/mmhead/test/sun/64",
    "free": false,
    "paymentProcessing": false,
    "paymentTime": null,
    "orderNumber": null,
    "paymentAmount": 0,
    "createTime": "2026-02-21T09:30:00Z",
    "updateTime": "2026-02-21T09:30:00Z"
  },
  {
    "_id": "user_006",
    "openid": "oTest-zhou-ba-openid-006",
    "name": "周八",
    "phone": "13800138006",
    "email": "zhouba@example.com",
    "gender": "female",
    "avatarUrl": "https://wx.qlogo.cn/mmhead/test/zhou/64",
    "free": false,
    "paymentProcessing": true,
    "paymentTime": "2026-02-21T08:45:00Z",
    "orderNumber": "ORDER20260221004",
    "paymentAmount": 199,
    "createTime": "2026-02-20T15:10:00Z",
    "updateTime": "2026-02-21T08:50:00Z"
  }
]
```

## 测试用户数据结构

以下是用于测试的用户数据，可以直接在云开发数据库中使用。

## 快速导入说明

### 方法1: 微信开发者工具导入
1. 打开微信开发者工具
2. 进入云开发控制台
3. 选择数据库 → User集合
4. 点击"导入数据"，选择JSON格式，复制上述完整JSON数组

### 方法2: 创建临时云函数批量导入
```javascript
const db = cloud.database();
const users = [...]; // 上述JSON数组

exports.main = async (event, context) => {
  try {
    for (let user of users) {
      await db.collection('User').add({
        data: user
      });
    }
    return { success: true, message: '测试数据导入成功' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
```

## 测试用户概览
- **张三** - 已激活会员 ✅
- **李四** - 支付处理中 🔄  
- **王五** - 未付款 ❌
- **赵六** - 已激活会员 ✅
- **孙七** - 未付款 ❌
- **周八** - 支付处理中 🔄

## 注意事项
- 测试数据的 `openid` 都以 `oTest-` 开头，便于识别
- 邮箱使用 `@example.com` 域名
- 支付金额统一为 199 元
- 涵盖支付系统的三种状态，可以全面测试支付功能