const db = wx.cloud.database();
const _ = db.command;
Page({
  data: {
    isLoginMode: true, // 默认登录模式
    authority: false,
    poster: '/icons/invite.png', 
    imageUrl: '/icons/invite.png',
    userInfo: {},
    name: '',
    openid: '',
    haslog: false,
    done: false,
    submit_status: false,
    theme: wx.getSystemSetting().theme,
    user_avatar: '',
    avatarUrl: '/icons/person.png',
    avatar_submit: false,
    debug: 'initial state',
    count: 0,
    selectedGender: '',
    onstack: false,
    isAgree:false //管理是否同意隐私协议
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({
      isLoginMode: mode === 'login'
    });
    
  },
  chooseGender(e) {
    const gender = e.currentTarget.dataset.gender;
    this.setData({
      selectedGender: gender
    });
  },

  async btnSub(e) {
    if (!this.data.isAgreed) {
      wx.showToast({ 
        title: '请先阅读并勾选下方的《用户协议》与《隐私政策》', 
        icon: 'none',
        duration: 2000
      });
      return; 
    }
    if (this.data.count !== 0 || this.data.onstack === true) {
      return;
    }
    this.setData({ onstack: true });

    if (this.data.isLoginMode) {
      await this.handleLogin(e);
    } else {
      await this.handleRegister(e);
    }
  },

  async handleRegister(e) {
    const realname = (e.detail.value.realname || '').trim();
    const phone = (e.detail.value.phone || '').trim();
    const account = (e.detail.value.account || '').trim();
    const password = (e.detail.value.password || '').trim();
    const confirmPassword = (e.detail.value.confirmPassword || '').trim();

    if (this.data.avatar_submit === false) {
      wx.showToast({ title: '请上传头像', icon: 'none' });
      this.setData({ onstack: false });
      return;
    }
    if (!realname) {
      wx.showToast({ title: '请输入真实姓名', icon: 'none' });
      this.setData({ onstack: false });
      return;
    }
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      this.setData({ onstack: false });
      return;
    }
    if (!account) {
      wx.showToast({ title: '请输入注册账号', icon: 'none' });
      this.setData({ onstack: false });
      return;
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' });
      this.setData({ onstack: false });
      return;
    }
    if (password !== confirmPassword) {
      wx.showToast({ title: '两次密码不一致', icon: 'none' });
      this.setData({ onstack: false });
      return;
    }
    if (!this.data.selectedGender) {
      wx.showToast({ title: '请选择性别', icon: 'none' });
      this.setData({ onstack: false });
      return;
    }

    try {
      const openidRes = await wx.cloud.callFunction({ name: 'get_openid' });
      const openidResult = (openidRes && openidRes.result) ? openidRes.result : {};
      const wxOpenid = openidResult.openid || openidResult.openId || '';
      if (!wxOpenid) {
        wx.showToast({ title: '微信身份获取失败', icon: 'none' });
        this.setData({ onstack: false });
        return;
      }
      wx.setStorageSync('wxOpenid', wxOpenid);

      const userResult = await db.collection('ActiveUser').where({
        _openid: wxOpenid
      }).get();
      
      const accountResult = await db.collection('ActiveUser').where(_.or([
        { account: account },
        { phone: phone }
      ])).get();

      if (accountResult.data.length > 0) {
        wx.showToast({ title: '该账号或手机号已被注册', icon: 'none' });
        this.setData({ onstack: false });
        return;
      }

      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: 'avatars/' + account + '_' + Date.now() + '.png',
        filePath: this.data.user_avatar
      });
      const avatarFileId = uploadResult.fileID;

      const randomNumericId = Date.now() % 1000000;
      const fakeAccountId = 'user_' + Date.now();

      const addResult = await db.collection('ActiveUser').add({
        data: {
          accountId: fakeAccountId, 
          account: account,
          password: password, 
          wxOpenid: wxOpenid,
          name: realname,
          phone: phone,
          numericId: randomNumericId,
          receive: {},
          send: {},
          gender: this.data.selectedGender,
          school: '',
          grade: '',
          canedit: true,
          love: '',
          message: '',
          partner: {
            hasPartner: false,
            partnerName: '',
            partnerAccountUserId: '',
            partnerNumericId: '',
            matchTime: null,
            matchType: '',
            allowRandomMatch: false
          },
          nickname: realname, // 未填写微信昵称时默认使用真实姓名作昵称
          image: avatarFileId,
          profile: {
            title: '',
            signature: '',
            avatar: avatarFileId,
            isPublic: true,
            completed: true
          },
          privacy: {
            allowSearch: true,
            allowInvitation: true
          },
          registration: {
            registered: false,
            paymentStatus: 'unpaid'
          },
          settings: {
            language: 'zh',
            canedit: true,
            lastLoginTime: new Date()
          }
        }
      });
      

      wx.showToast({ title: '注册成功！', icon: 'success' });
      const createdUserResult = await db.collection('ActiveUser').doc(addResult._id).get();
      this.saveLoginState(createdUserResult.data,true);
      
    } catch (err) {
      console.error('注册失败:', err);
      wx.showToast({ title: '注册失败', icon: 'none' });
      this.setData({ onstack: false });
    }
  },

  async handleLogin(e) {
    const account = (e.detail.value.account || '').trim();
    const password = (e.detail.value.password || '').trim();

    if (!account || !password) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' });
      this.setData({ onstack: false });
      return;
    }

    try {
      const userResult = await db.collection('ActiveUser').where({
        account: account,
        password: password
      }).get();

      if (userResult.data.length === 0) {
        wx.showToast({ title: '账号或密码错误', icon: 'none' });
        this.setData({ onstack: false });
        return;
      }

      const activeUser = userResult.data[0];

      await db.collection('ActiveUser').doc(activeUser._id).update({
        data: {
          'settings.lastLoginTime': new Date()
        }
      });

      wx.showToast({ title: '登录成功', icon: 'success' });
      this.saveLoginState(activeUser);

    } catch (err) {
      console.error('登录失败:', err);
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
      this.setData({ onstack: false });
    }
  },

  saveLoginState(activeUser, isRegister) {
    const app = getApp();
    const userOpenid = activeUser.wxOpenid || activeUser._openid;
    
    wx.setStorageSync('openid', userOpenid); 
    wx.setStorageSync('accountUserId', activeUser._id);
    wx.setStorageSync('accountId', activeUser.accountId);
    wx.setStorageSync('isLoggedIn', true);
    wx.setStorageSync('userInfo', {
      name: activeUser.name,
      phone: activeUser.phone,
      numericId: activeUser.numericId,
      nickname: activeUser.nickname,
      hasPartner: !!(activeUser.partner && activeUser.partner.hasPartner)
    });

    if(app) {
      app.globalData.openid = userOpenid;
      app.globalData.userInfo = activeUser;
    }
    if (isRegister) {
      wx.setStorageSync('isJustRegistered', true); 
    }

    this.setData({
      onstack: false,
      count: 1
    });

    setTimeout(() => {
      wx.switchTab({ url: '../home/home' });
    }, 1000);
  },

  onChooseAvatar(e) {
    const avatarUrl = e && e.detail ? e.detail.avatarUrl : '';
    if (!avatarUrl) {
      return;
    }
    this.setData({
      avatarUrl: avatarUrl,
      user_avatar: avatarUrl,
      avatar_submit: true
    });
  },

  onAvatarError(e) {
    const errMsg = (e && e.detail && e.detail.errMsg) ? e.detail.errMsg : '';   
    if (errMsg.includes('cancel')) {
      return;
    }
    wx.showToast({
      title: '头像选择失败',
      icon: 'none'
    });
  },
  onAgreeChange(e) {
    // 微信的 checkbox 选中时会把 value 放到数组里传过来
    const checked = e.detail.value.length > 0; 
    this.setData({
      isAgreed: checked
    });
  },

  // 跳转到《用户服务协议》页面
  goToUserAgreement() {
    wx.navigateTo({
      url: '/pages/agreement/agreement' 
    });
  },

  // 跳转到《隐私政策》页面
  goToPrivacyPolicy() {
    wx.navigateTo({
      url: '/pages/privacy/privacy' 
    });
  },

  onLoad: function (options) {
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    const accountUserId = wx.getStorageSync('accountUserId');
    if (isLoggedIn && accountUserId) {
      wx.switchTab({ url: '../home/home' });
      return;
    }
    this.setData({ done: true });
  }
});