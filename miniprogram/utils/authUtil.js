// 用户认证工具类
class AuthUtil {
  
  /**
   * 获取当前用户OpenID
   */
  static getOpenID() {
    return wx.getStorageSync('openid') || '';
  }

  static getAccountUserId() {
    return wx.getStorageSync('accountUserId') || '';
  }
  
  /**
   * 检查用户是否已登录
   */
  static isLoggedIn() {
    const accountUserId = this.getAccountUserId();
    const openid = this.getOpenID();
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    return !!((accountUserId || openid) && isLoggedIn);
  }
  
  /**
   * 统一的登录检查，未登录时自动跳转
   * @param {string} redirectPath - 可选的重定向路径
   * @returns {boolean} 是否已登录
   */
  static checkLoginStatus(redirectPath = '/pages/login/login') {
    if (!this.isLoggedIn()) {
      console.log('❌ 用户未登录，跳转到登录页');
      wx.redirectTo({ url: redirectPath });
      return false;
    }
    return true;
  }
  
  /**
   * 保存登录状态
   * @param {string} openid - 用户OpenID
   * @param {object} userInfo - 用户基本信息
   */
  static saveLoginState(openid, userInfo) {
    wx.setStorageSync('openid', openid);
    if (userInfo && userInfo.accountUserId) {
      wx.setStorageSync('accountUserId', userInfo.accountUserId);
    }
    if (userInfo && userInfo.accountId) {
      wx.setStorageSync('accountId', userInfo.accountId);
    }
    wx.setStorageSync('isLoggedIn', true);
    wx.setStorageSync('userInfo', userInfo);
    console.log('✅ 登录状态已保存');
  }
  
  /**
   * 清除登录状态
   */
  static clearLoginState() {
    wx.removeStorageSync('openid');
    wx.removeStorageSync('wxOpenid');
    wx.removeStorageSync('accountUserId');
    wx.removeStorageSync('accountId');
    wx.removeStorageSync('isLoggedIn'); 
    wx.removeStorageSync('userInfo');
    console.log('🚫 登录状态已清除');
  }
  
  /**
   * 获取缓存的用户信息
   */
  static getCachedUserInfo() {
    return wx.getStorageSync('userInfo') || null;
  }
  
  /**
   * 验证输入格式
   */
  static validateInput(name, phone) {
    if (!name || name.trim() === '') {
      wx.showToast({ title: '请输入姓名', icon: 'error' });
      return false;
    }
    
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'error' });
      return false;
    }
    
    return true;
  }
}

module.exports = AuthUtil;