# STARLET 百老汇之夜 - 舞伴匹配小程序 v0.9

## 项目概述

这是一个全新升级的舞伴匹配小程序，采用现代化的架构设计，提供完整的用户注册、舞伴匹配、邀请系统和会员支付功能。本版本引入了数字ID系统、隐私设置、引导式注册流程和扫码支付机制。

### 核心特性

-  **数字ID系统**：每位用户都有唯一的数字ID，便于搜索和识别
-  **隐私保护**：细粒度的隐私设置，用户可控制信息可见性
-  **引导式注册**：5步引导式资料完善流程
-  **智能搜索**：基于数字ID的精确搜索功能
-  **邀请系统**：完整的邀请发送、接收和管理功能
-  **会员支付**：扫码支付系统，支持手动激活管理
-  **流程控制**：确保用户按正确步骤完成所有必要流程

## 系统架构

### 技术栈
- **前端**：微信小程序（JavaScript + WXML + WXSS）
- **后端**：微信云开发（云函数）
- **数据库**：云数据库（MongoDB）
- **存储**：云存储（用户头像等文件）

### 数据库的宜统一为4个集合：
1. **User**: 用户基础信息和支付状态
2. **ActiveUser**: 活跃用户详细信息和舞伴关系
3. **Invitations**: 邀请记录管理

## 数据库设计

### 1. User 集合（用户基础信息和支付状态）
**实际使用**: login.js(验证), registration.js(支付状态查询)
```json
{
  "_id": "auto_generated_id",
  "name": "用户姓名",
  "phone": "手机号码", 
  "gender": "male/female",
  "school": "学校名称",
  "order": 1,
  "free": true,
  "paymentProcessing": false,
  "paymentTime": "2026-02-15T10:30:00Z",
  "orderNumber": "ORDER20260215001",
  "paymentAmount": 199
}
```

**字段说明**：
- `name`: 用户姓名，用于登录验证（用户名）
- `phone`: 手机号码，用于登录验证（密码）
- `free`: 会员激活状态 (true=已激活会员, false=未激活)
- `paymentProcessing`: 支付处理状态 (true=处理中, false=已完成/未开始)
- `paymentTime`: 支付时间戳
- `orderNumber`: 支付订单号
- `paymentAmount`: 支付金额

### 2. ActiveUser 集合（活跃用户信息）
**实际使用**: 几乎所有页面(用户列表、个人信息、舞伴关系)
```json
{
  "_id": "auto_generated_id",
  "_openid": "wx_openid_string",
  "name": "用户姓名",
  "phone": "手机号",
  "gender": "男/女",
  "school": "学校名称",
  "grade": "年级",
  "hasPartner": false,
  "partner": "舞伴姓名",
  "mypartner": "我的舞伴", 
  "order": 1,
  "free": true,
  "love": "拉丁舞",
  "message": "个人介绍",
  "nickname": "用户昵称",
  "image": "/images/default.jpg"
}
```

### 3. Invitations 集合（邀请记录）
**实际使用**: email.js, invite.js, partner.js, view.js
```json
{
  "_id": "auto_generated_id",
  "senderid": "sender_openid",
  "receiverid": "receiver_openid", 
  "sendername": "发送者姓名",
  "receivername": "接收者姓名",
  "message": "邀请消息内容",
  "status": "pending/accepted/rejected"
}
```

## 云函数模块

### 核心云函数

#### 1. get_openid
**功能**：获取用户OpenID，用于身份验证
```javascript
// 返回结果
{
  "success": true,
  "openid": "wx_user_openid"
}
```

#### 2. find_data_active_user
**功能**：获取活跃用户列表，支持分页
```javascript
// 返回结果
{
  "success": true,
  "data": [
    {
      "name": "用户姓名",
      "numericId": 10001,
      "hasPartner": false,
      "profile": { /* 用户资料 */ }
    }
  ]
}
```

#### 3. modify_partner
**功能**：修改舞伴关系，在用户接受邀请时调用
```javascript
// 输入参数
{
  "dataobj": {
    "_openid": "user1_openid", 
    "name": "用户1"
  },
  "user": {
    "_openid": "user2_openid",
    "name": "用户2"
  }
}

// 返回结果
{
  "success": true,
  "message": "舞伴关系建立成功"
}
```

#### 4. delete_partner
**功能**：解除舞伴关系
```javascript
// 输入参数
{
  "user1_openid": "openid1",
  "user2_openid": "openid2"
}

// 返回结果
{
  "success": true,
  "message": "舞伴关系解除成功"
}
```

#### 5. email_invitation
**功能**：获取用户收到的邀请列表
```javascript
// 输入参数
{
  "receiverid": "user_openid"
}

// 返回结果
{
  "success": true,
  "invitations": [
    {
      "senderid": "sender_openid",
      "sendername": "发送者姓名",
      "message": "邀请消息",
      "status": "pending"
    }
  ]
}
```

#### 6. invite_invitation
**功能**：获取用户发送的邀请列表
```javascript
// 输入参数
{
  "senderid": "user_openid"
}

// 返回结果
{
  "success": true,
  "invitations": [
    {
      "receiverid": "receiver_openid",
      "receivername": "接收者姓名",
      "message": "邀请消息",
      "status": "pending"
    }
  ]
}
```

#### 7. gender_preference
**功能**：设置用户性别偏好
```javascript
// 输入参数
{
  "dataobj": {
    "_openid": "user_openid",
    "_preference": "男/女/无偏好"
  }
}

// 返回结果
{
  "success": true,
  "message": "偏好设置成功"
}
```

### 传统云函数

以上云函数构成了完整的后端业务逻辑，支持：
- 用户身份验证
- 活跃用户管理
- 邀请收发管理
- 舞伴关系管理
- 用户偏好设置

## 前端页面模块

### 核心导航结构

#### Tab栏页面
1. **首页** (pages/home/)
2. **搜索** (pages/search/)  
3. **邀请** (pages/invitation/)
4. **会员** (pages/registration/) - 会员支付和激活
5. **我的** (pages/mine/)

### 详细页面说明

#### 1. 登录页面 (pages/login/)

**功能**：用户登录和新用户引导
**核心逻辑**：
- 验证用户信息与User数据库
- 检查是否已完成资料设置
- 引导新用户到profile-setup页面
- 老用户直接进入主界面

**关键方法**：
```javascript
btnSub() // 提交登录
checkUserStatus() // 检查用户状态
```

#### 2. 资料设置页面 (pages/profile-setup/)

**功能**：引导式5步资料完善流程
**步骤流程**：
1. 基础信息（专业、年级）
2. 舞蹈经验设置
3. 头像上传
4. 隐私设置配置
5. 个性签名设置

**核心逻辑**：
```javascript
nextStep() // 下一步
prevStep() // 上一步
submitProfile() // 提交完整资料
uploadAvatar() // 头像上传
```

**界面特色**：邀请卡片风格设计，步骤指示器

#### 3. 首页 (pages/home/)

**功能**：用户列表展示和筛选
**新特性**：
- 按舞伴状态分类显示
- 支持性别筛选
- 优先显示无舞伴用户
- 集成流程控制检查

**核心方法**：
```javascript
loadUserData() // 加载用户数据
filterUsers() // 筛选用户
navigateToProfile() // 查看用户详情
```

#### 4. 搜索页面 (pages/search/)

**功能**：基于数字ID的精确搜索
**核心特性**：
- 数字ID搜索验证
- 隐私设置尊重
- 即时邀请发送
- 搜索结果详细展示

**核心方法**：
```javascript
onSearchTap() // 执行搜索
onSendInvitation() // 发送邀请
onClearResult() // 清空结果
```

#### 5. 邀请管理页面 (pages/invitation/)

**功能**：完整的邀请收发管理
**标签页设计**：
- 收到的邀请（支持回复）
- 发送的邀请（查看状态）

**核心方法**：
```javascript
loadInvitations() // 加载邀请列表
onAcceptInvitation() // 接受邀请
onRejectInvitation() // 拒绝邀请
onShowReplyModal() // 显示回复框
```

**特色功能**：
- 实时状态显示
- 带消息的回复系统
- 自动拒绝冲突邀请

#### 6. 会员支付页面 (pages/registration/)

**功能**：会员支付和激活管理
**核心特性**：
- 用户信息自动填充
- 扫码支付流程
- 支付状态跟踪
- 手动激活工作流
- 会员权益展示

**会员状态**：
- 未付款：显示支付界面和会员权益
- 处理中：用户已确认支付，等待管理员激活
- 已激活：显示会员状态和权益

**核心方法**：
```javascript
loadData() // 加载用户数据和支付状态
onShowPaymentQR() // 显示支付二维码
onSubmitPayment() // 确认支付
handlePaymentStatus() // 处理支付状态变更
```

**支付流程**：
- 展示用户信息和会员权益
- 用户点击支付 → 显示二维码
- 用户扫码支付 → 确认支付
- 状态变为处理中 → 管理员手动激活

#### 7. 个人中心页面 (pages/mine/)

**功能**：个人信息管理和设置
**主要模块**：
- 基本信息显示
- 舞伴关系管理
- 隐私设置调整
- 系统设置

#### 8. 编辑页面 (pages/edit-new/)

**功能**：高级资料编辑功能
**特色**：
- 富文本编辑器
- 实时字符计数
- 头像重新上传
- 变更检测提醒

### 组件模块

#### Tabs组件 (components/Tabs/)
**功能**：可重用的标签页切换组件
**特性**：
- 动画效果
- 自定义样式
- 事件传递

### 工具模块

#### userFlow.js (utils/userFlow.js)
**功能**：用户流程控制核心工具
**主要方法**：
```javascript
checkUserStatus() // 检查用户状态
getCurrentUser() // 获取当前用户
updateUserStatus() // 更新用户状态
redirectToRequired() // 重定向到需要页面
```

**流程控制逻辑**：
1. 检查登录状态 → login页面
2. 检查资料完整度 → profile-setup页面
3. 允许正常访问功能页面

#### utils.js (utils/utils.js)
**功能**：通用工具函数库
**主要方法**：
- 时间格式化
- 数据验证
- 图片处理
- 错误处理

#### i18n.js (utils/i18n.js)
**功能**：国际化支持
**支持语言**：中文、英文

## 用户流程设计

### 新用户完整流程

```
1. 打开小程序 
   ↓
2. login页面 → 输入基本信息
   ↓
3. profile-setup页面 → 5步引导设置
   ↓
4. 获取数字ID → 完成注册
   ↓
5. home页面 → 浏览其他用户
   ↓
6. search页面 → 搜索目标用户
   ↓
7. 发送邀请 → 等待回复
   ↓
8. 配对成功 → 可以报名比赛
```

### 舞伴匹配流程

```
搜索用户 → 查看资料 → 发送邀请
          ↓
     邀请通知 → 对方查看 → 回复邀请
          ↓
     配对成功 → 自动拒绝其他邀请
```

### 会员支付流程

```
检查用户状态 → 查看会员权益 → 选择支付方式
     ↓
扫码支付 → 确认支付 → 状态变更为"处理中"
     ↓
管理员审核 → 手动激活 → 成为正式会员
     ↓
享受会员权益 → 无限制舞伴匹配
```

## 开发环境配置

### 1. 项目初始化

#### 克隆项目
```bash
git clone [项目地址]
cd 2025JIDancePart
```

#### 安装依赖
```bash
npm install
```

#### 微信开发者工具导入
1. 打开微信开发者工具
2. 导入项目
3. 填写AppID和项目配置

### 2. 云开发配置

#### 创建云环境
1. 在微信开发者工具中开启云开发
2. 创建测试环境和生产环境
3. 获取环境ID

#### 部署云函数
```bash
# 使用批量部署脚本
uploadCloudFunction.bat

# 或手动部署每个云函数
右键点击云函数文件夹 → 上传并部署
```

#### 初始化数据库
1. 创建必要的数据库集合
2. 设置数据库权限规则
3. 导入测试数据

### 3. 测试数据准备

#### 创建测试用户
```json
// User集合
{
  "name": "测试用户1",
  "phone": "12345678901",
  "gender": "男",
  "school": "测试大学",
  "order": 1,
  "free": true
}
```

#### 创建管理员设置
```json
// AdminSettings集合
{
  "_id": "admin_settings",
  "competitions": [
    {
      "id": "test_comp_001",
      "name": "测试比赛",
      "date": "2024-06-01",
      "registrationDeadline": "2024-05-15",
      "price": 100,
      "status": "open"
    }
  ]
}
```

### 4. 调试技巧

#### 快速登录设置
在开发环境中的login.js添加：
```javascript
// 开发环境快速登录
if (wx.getSystemSetting().platform === 'devtools') {
  this.autoDevLogin();
}
```

#### 跳过流程控制
在开发中可以临时修改userFlow.js：
```javascript
// 临时跳过流程检查
checkUserStatus() {
  return { canAccess: true };
}
```

#### 云函数本地调试
使用云开发控制台的云函数测试功能：
1. 选择要测试的云函数
2. 输入测试参数
3. 查看执行结果和日志

## 部署指南

### 1. 生产环境准备

#### 环境变量配置
1. 设置生产环境的AppID
2. 配置云环境ID
3. 更新域名配置

#### 数据库迁移
1. 导出开发环境数据
2. 清理测试数据
3. 导入生产环境

#### 云函数部署
```bash
# 部署到生产环境
1. 切换到生产环境
2. 重新部署所有云函数
3. 测试云函数功能
```

### 2. 版本发布

#### 代码审查检查清单
- [ ] 移除所有调试代码
- [ ] 移除测试用户快捷登录
- [ ] 验证所有云函数正常工作
- [ ] 测试完整用户流程
- [ ] 检查敏感信息是否移除

#### 小程序提交
1. 小程序代码上传
2. 填写版本说明
3. 提交审核
4. 发布上线

### 3. 监控与维护

#### 性能监控
- 页面加载性能
- 云函数执行时间
- 数据库查询效率
- 用户行为分析

#### 日志管理
- 错误日志收集
- 用户操作日志
- 系统性能日志
- 业务数据统计

## 常见问题解决

### 开发问题

#### Q1: 登录失败
**原因**：User集合没有对应数据
**解决**：确保数据库中有测试用户数据

#### Q2: 云函数调用失败
**原因**：环境ID配置错误或云函数未部署
**解决**：检查project.config.json中的环境ID，重新部署云函数

#### Q3: 头像上传失败
**原因**：云存储权限设置问题
**解决**：检查云存储的权限配置，允许用户上传

#### Q4: 数字ID重复
**原因**：并发请求导致ID分配冲突
**解决**：使用事务处理ID分配

### 用户问题

#### Q1: 无法搜索到用户
**原因**：目标用户设置了隐私保护
**解决**：提示用户检查隐私设置

#### Q2: 邀请发送失败
**原因**：对方不接受邀请或已有舞伴
**解决**：检查对方状态，提供明确错误提示

#### Q3: 报名优惠计算错误
**原因**：历史订单数据统计错误
**解决**：核查数据库中的订单记录

### 性能问题

#### Q1: 页面加载慢
**原因**：数据库查询效率低
**解决**：添加必要的数据库索引，优化查询条件

#### Q2: 云函数超时
**原因**：复杂数据处理耗时长
**解决**：优化算法，使用分批处理

## 扩展功能建议

### 短期优化
1. **消息推送**：邀请通知、配对成功通知
2. **数据统计**：用户活跃度、配对成功率
3. **社交功能**：用户评价、推荐系统
4. **活动管理**：比赛详情页、报名状态跟踪

### 长期规划
1. **AI匹配**：智能舞伴推荐算法
2. **视频功能**：舞蹈视频展示
3. **社区功能**：讨论区、经验分享
4. **多平台支持**：H5版本、APP版本

## 总结

这个舞伴匹配小程序v2.0版本提供了完整的用户管理、舞伴匹配和活动报名功能。通过现代化的架构设计和用户体验优化，为舞蹈爱好者提供了一个专业、易用的平台。

项目采用微信云开发技术，降低了后端维护成本，同时保证了数据安全性和系统稳定性。通过详细的文档和规范的代码结构，便于后续的维护和功能扩展。

如有疑问或需要技术支持，请参考本文档的相关章节，或通过项目仓库提交issues。