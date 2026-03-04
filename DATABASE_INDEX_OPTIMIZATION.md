# 数据库索引优化建议

## 概述

根据自动检测发现的查询性能问题，需要为ActiveUser集合创建必要的索引以提高查询效率。

## 当前发现的查询性能问题

### 1. ActiveUser集合 - 用户身份验证查询

**查询语句：**
```javascript
db.collection('ActiveUser').where({
  name: '张三',
  phone: '13800138001'
}).get()
```

**问题分析：**
- 该查询在登录验证时频繁使用
- 需要同时匹配`name`和`phone`字段
- 缺少组合索引会导致全表扫描，性能低下

**索引建议：**
```json
{
  "name": 1,    // 升序索引
  "phone": 1    // 升序索引
}
```

## 索引创建方法

### 方法一：通过微信开发者工具控制台创建

1. 打开微信开发者工具
2. 进入云开发控制台
3. 选择数据库
4. 进入ActiveUser集合
5. 点击"索引管理"
6. 点击"新建索引"
7. 添加以下字段：
   - `name`: 升序
   - `phone`: 升序

### 方法二：使用快速创建链接

点击以下链接快速创建索引：
```
cloud://createindex?env=cloud1-1gfcqh4gb2738619&collection=ActiveUser&from=console&s=%5B%7B%22field%22%3A%22name%22%2C%22type%22%3A1%7D%2C%7B%22field%22%3A%22phone%22%2C%22type%22%3A1%7D%5D
```

### 方法三：通过代码方式创建（开发环境）

```javascript
// 在云函数中创建索引
const db = cloud.database()

// 创建ActiveUser表的组合索引
await db.collection('ActiveUser').createIndex({
  index: [
    { field: 'name', type: 1 },
    { field: 'phone', type: 1 }
  ],
  name: 'name_phone_index'
})
```

## 其他建议的索引优化

### 1. ActiveUser集合的其他常用查询

**按OpenID查询（用于用户信息获取）**
```javascript
// 查询：
db.collection('ActiveUser').where({ _openid: 'xxx' }).get()

// 建议索引：
{ "_openid": 1 }
```

**按数字ID搜索（用于搜索功能）**
```javascript  
// 查询：
db.collection('ActiveUser').where({ numericId: 12345 }).get()

// 建议索引：
{ "numericId": 1 }
```

**按舞伴状态筛选（用于首页展示）**
```javascript
// 查询：
db.collection('ActiveUser').where({ hasPartner: false }).get()

// 建议索引：
{ "hasPartner": 1 }
```

### 2. Invitations集合索引优化

**按接收人查询邀请**
```javascript
// 查询：
db.collection('Invitations').where({ receiverid: 'xxx' }).get()

// 建议索引：
{ "receiverid": 1 }
```

**按发送人查询邀请**
```javascript
// 查询：
db.collection('Invitations').where({ senderid: 'xxx' }).get()

// 建议索引：
{ "senderid": 1 }
```

**按状态查询邀请**
```javascript
// 查询：
db.collection('Invitations').where({ 
  receiverid: 'xxx', 
  status: 'pending' 
}).get()

// 建议组合索引：
{ "receiverid": 1, "status": 1 }
```

### 3. User集合索引优化

**登录验证查询**
```javascript
// 查询：
db.collection('User').where({ 
  name: 'username', 
  phone: 'password' 
}).get()

// 建议组合索引：
{ "name": 1, "phone": 1 }
```

## 索引性能监控

### 查询性能检查

创建索引后，可以通过以下方式验证查询性能：

1. **开发者工具监控**：
   - 在云开发控制台查看"性能分析"
   - 观察查询执行时间变化

2. **代码中添加性能监控**：
```javascript
// 查询前记录时间
const startTime = Date.now()

const result = await db.collection('ActiveUser')
  .where({ name: 'xxx', phone: 'xxx' })
  .get()

// 查询后计算耗时
const duration = Date.now() - startTime
console.log(`查询耗时: ${duration}ms`)
```

## 注意事项

1. **索引空间成本**：索引会占用额外的存储空间
2. **写入性能影响**：过多索引可能影响数据插入和更新性能
3. **索引维护**：定期检查和清理不再使用的索引
4. **查询优化**：配合合理的查询条件顺序提高索引使用效率

## 优先级建议

**高优先级（立即创建）**：
1. ActiveUser.{name, phone} - 登录验证
2. ActiveUser._openid - 用户信息获取
3. Invitations.receiverid - 查看收到的邀请

**中优先级（近期创建）**：
1. ActiveUser.numericId - 搜索功能
2. ActiveUser.hasPartner - 首页筛选
3. Invitations.{receiverid, status} - 邀请状态查询

**低优先级（按需创建）**：
1. User.{name, phone} - 如果通过User表进行频繁查询
2. 其他业务特定的查询索引

---

*请根据实际生产环境的查询模式和性能需求，优先创建对当前业务最关键的索引。*