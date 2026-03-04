// 用户流程控制工具
const db = wx.cloud.database();

function getSessionIdentity() {
  const accountUserId = wx.getStorageSync('accountUserId');
  const openid = wx.getStorageSync('openid');
  return {
    accountUserId: accountUserId || '',
    openid: openid || ''
  };
}

function queryCurrentActiveUser() {
  return new Promise((resolve, reject) => {
    const { accountUserId, openid } = getSessionIdentity();
    const wxOpenid = wx.getStorageSync('wxOpenid') || '';

    const tryByOpenid = () => {
      const id = openid || wxOpenid;
      if (!id) { reject('用户未登录'); return; }
      db.collection('ActiveUser').where({ _openid: id }).get({
        success: res => {
          if (!res.data || !res.data.length) {
            // try wxOpenid field as last resort
            if (wxOpenid && wxOpenid !== id) {
              db.collection('ActiveUser').where({ wxOpenid: wxOpenid }).get({
                success: r => r.data && r.data.length ? resolve(r.data[0]) : reject('用户不存在'),
                fail: reject
              });
            } else {
              reject('用户不存在');
            }
            return;
          }
          resolve(res.data[0]);
        },
        fail: reject
      });
    };

    if (accountUserId) {
      db.collection('ActiveUser').doc(accountUserId).get({
        success: res => {
          if (!res.data) { tryByOpenid(); return; }
          resolve(res.data);
        },
        fail: () => tryByOpenid()
      });
      return;
    }

    tryByOpenid();
  });
}

/**
 * 检查用户是否完成了必要的设置步骤
 * @param {string} requiredStep - 需要的步骤：'profile' | 'registration'
 * @param {object} options - 配置选项
 * @returns {Promise} - 返回检查结果
 */
function checkUserStatus(requiredStep = 'profile', options = {}) {
  return new Promise((resolve, reject) => {
    const { accountUserId, openid } = getSessionIdentity();

    if (!accountUserId && !openid) {
      // 用户未登录，跳转到登录页
      wx.redirectTo({
        url: '/pages/login/login'
      });
      reject('用户未登录');
      return;
    }

    queryCurrentActiveUser()
      .then(user => {
          let shouldRedirect = false;
          let redirectUrl = '';

          // 检查profile是否完成
          if (requiredStep === 'profile' || requiredStep === 'all') {
            if (!user.profile || !user.profile.completed) {
              shouldRedirect = true;
              redirectUrl = `/pages/profile-setup/profile-setup?numericId=${user.numericId || ''}`;
            }
          }

          // 检查报名是否需要（如果需要的话）
          if ((requiredStep === 'registration' || requiredStep === 'all') && !shouldRedirect) {
            // 这里可以添加报名检查逻辑
            // if (需要报名 && !user.registration.registered) {
            //   shouldRedirect = true;
            //   redirectUrl = '/pages/registration/registration';
            // }
          }

          if (shouldRedirect && !options.skipRedirect) {
            if (options.showTip) {
              wx.showModal({
                title: '提示',
                content: options.tipContent || '请先完善您的个人资料',
                showCancel: false,
                success: () => {
                  wx.redirectTo({ url: redirectUrl });
                }
              });
            } else {
              wx.redirectTo({ url: redirectUrl });
            }
            reject('用户资料未完善');
            return;
          }

          resolve(user);
      })
      .catch(err => {
        console.error('查询用户状态失败:', err);
        if (!options.skipRedirect) {
          wx.redirectTo({
            url: '/pages/login/login'
          });
        }
        reject(err);
      });
  });
}

/**
 * 检查页面访问权限（轻量级，不跳转）
 * @param {string} requiredStep 
 * @returns {Promise}
 */
function checkPermission(requiredStep = 'profile') {
  return new Promise((resolve, reject) => {
    const { accountUserId, openid } = getSessionIdentity();

    if (!accountUserId && !openid) {
      reject('未登录');
      return;
    }

    queryCurrentActiveUser()
      .then(user => {
        if (requiredStep === 'profile' && (!user.profile || !user.profile.completed)) {
          reject('资料未完善');
          return;
        }

        resolve(user);
      });
      
  });
}

/**
 * 获取当前用户信息
 * @returns {Promise}
 */
function getCurrentUser() {
  return new Promise((resolve, reject) => {
    const { accountUserId, openid } = getSessionIdentity();

    if (!accountUserId && !openid) {
      reject('未登录');
      return;
    }

    queryCurrentActiveUser().then(resolve).catch(reject);
  });
}

/**
 * 更新用户状态
 * @param {object} updateData 
 * @returns {Promise}
 */
function updateUserStatus(updateData) {
  return new Promise((resolve, reject) => {
    const { accountUserId, openid } = getSessionIdentity();

    if (!accountUserId && !openid) {
      reject('未登录');
      return;
    }

    if (accountUserId) {
      db.collection('ActiveUser').doc(accountUserId).update({
        data: updateData,
        success: resolve,
        fail: reject
      });
      return;
    }

    db.collection('ActiveUser').where({ _openid: openid }).update({
      data: updateData,
      success: resolve,
      fail: reject
    });
  });
}

module.exports = {
  checkUserStatus,
  checkPermission,
  getCurrentUser,
  updateUserStatus
};