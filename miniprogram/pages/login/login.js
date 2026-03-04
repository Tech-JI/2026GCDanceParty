// 登陆页面
const db = wx.cloud.database();
const _ = db.command;
Page({
  data: {
    authority: false, // 用户是否微信授权头像和昵称，不授权不能来玩！
    // 海报的图片 - 使用本地图片或CDN
    poster: "/icons/invite.png", 
    imageUrl: "/icons/invite.png",
    userInfo: {}, // 用户填写的信息
    name: "", // 用户填入的姓名
    openid: '', // 用户的openid
    haslog: false, // 用户是否已经登陆过了
    done: false, // 页面和数据库是否加载完毕,
    submit_status: false,
    
    theme: wx.getSystemSetting().theme,
    user_avatar: "",
    avatarUrl: "/icons/person.png", // 默认头像
    avatar_submit: false,
    debug: "initial state",
    count: 0,
    onstack: false
  },

  async btnSub(e) {
    if (this.data.count !== 0 || this.data.onstack === true) {
      return;
    }

    this.setData({ onstack: true });

    const nickname = (e.detail.value.nickname || '').trim();
    const userid = (e.detail.value.userid || '').trim();
    const password = (e.detail.value.password || '').trim();

    if (!userid) {
      wx.showToast({ title: '请输入姓名', icon: 'error' });
      this.setData({ onstack: false });
      return;
    }

    if (!password || !/^1[3-9]\d{9}$/.test(password)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'error' });
      this.setData({ onstack: false });
      return;
    }

    try {
      const openidRes = await wx.cloud.callFunction({ name: 'get_openid' });
      const openidResult = (openidRes && openidRes.result) ? openidRes.result : {};
      const wxOpenid = openidResult.openid || openidResult.openId || '';
      if (!wxOpenid) {
        wx.showToast({ title: '微信身份获取失败', icon: 'error' });
        this.setData({ onstack: false });
        return;
      }

      wx.setStorageSync('wxOpenid', wxOpenid);

      const userResult = await db.collection('User').where({
        name: userid,
        phone: password
      }).get();

      if (!userResult.data.length) {
        wx.showToast({ title: '用户名或手机号错误', icon: 'error' });
        this.setData({ onstack: false });
        return;
      }

      const person = userResult.data[0];

      let activeResult = await db.collection('ActiveUser').where({ accountId: person._id }).get();
      if (!activeResult.data.length) {
        activeResult = await db.collection('ActiveUser').where({
          name: userid,
          phone: password
        }).get();
      }

      let activeUser = null;

      if (!activeResult.data.length) {
        if (this.data.avatar_submit === false) {
          wx.showToast({ title: '请上传头像', icon: 'error', mask: true });
          this.setData({ onstack: false });
          return;
        }

        if (!nickname) {
          wx.showToast({ title: '请填写昵称', icon: 'error', mask: true });
          this.setData({ onstack: false });
          return;
        }

        const uploadResult = await wx.cloud.uploadFile({
          cloudPath: `avatars/${userid}_${Date.now()}.png`,
          filePath: this.data.user_avatar
        });

        const avatarFileId = uploadResult.fileID;
        const addResult = await db.collection('ActiveUser').add({
          data: {
            accountId: person._id,
            wxOpenid: wxOpenid,
            name: person.name,
            phone: person.phone,
            receive: {},
            send: {},
            gender: '',
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
            nickname: nickname,
            image: avatarFileId
          }
        });

        const tempNumericId = Date.now() % 1000000;
        await db.collection('ActiveUser').doc(addResult._id).update({
          data: {
            numericId: tempNumericId,
            profile: {
              title: '',
              signature: '',
              avatar: avatarFileId,
              isPublic: true,
              completed: true
            },
            privacy: {
              allowSearch: true,
              allowInvitation: true,
              showSchool: true,
              showMajor: true,
              showGrade: true,
              showExperience: true,
              showAvatar: true,
              showSignature: true
            },
            registration: {
              registered: false,
              hasDiscount: false,
              discountProof: '',
              discountStatus: 'pending',
              paymentStatus: 'unpaid',
              orderId: '',
              paymentTime: null,
              qrCodeShown: false
            },
            settings: {
              language: 'zh',
              canedit: true,
              lastLoginTime: new Date()
            }
          }
        });

        const createdUserResult = await db.collection('ActiveUser').doc(addResult._id).get();
        activeUser = createdUserResult.data;

        wx.showToast({ title: '注册成功', icon: 'success' });
      } else {
        activeUser = activeResult.data[0];

        await db.collection('ActiveUser').doc(activeUser._id).update({
          data: {
            accountId: person._id,
            wxOpenid: wxOpenid,
            'settings.lastLoginTime': new Date()
          }
        });

        const isProfileComplete = activeUser.name && activeUser.phone && activeUser.nickname;
        if (isProfileComplete && (!activeUser.profile || !activeUser.profile.completed)) {
          await db.collection('ActiveUser').doc(activeUser._id).update({
            data: {
              'profile.completed': true,
              'profile.isPublic': true
            }
          });
        }

        wx.showToast({ title: '登录成功', icon: 'success' });
      }

      wx.setStorageSync('openid', activeUser._openid);
      wx.setStorageSync('accountUserId', activeUser._id);
      wx.setStorageSync('accountId', person._id);
      wx.setStorageSync('isLoggedIn', true);
      wx.setStorageSync('userInfo', {
        name: activeUser.name,
        phone: activeUser.phone,
        numericId: activeUser.numericId,
        nickname: activeUser.nickname,
        hasPartner: !!(activeUser.partner && activeUser.partner.hasPartner)
      });

      this.setData({
        onstack: false,
        count: 1
      });

      wx.switchTab({ url: '../home/home' });
    } catch (err) {
      console.error('❌ 登录流程失败:', err);
      wx.showToast({ title: '登录失败，请重试', icon: 'error' });
      this.setData({ onstack: false });
    }
  },

  onChooseAvatar(e) {
    const avatarUrl = e && e.detail ? e.detail.avatarUrl : '';
    if (!avatarUrl) {
      return;
    }
    console.log('🖼️ 选择头像:', avatarUrl);
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

    console.error('❌ 头像选择失败:', errMsg || e);
    wx.showToast({
      title: '头像选择失败',
      icon: 'none'
    });
  },

  onLoad: function (options) {
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    const accountUserId = wx.getStorageSync('accountUserId');
    if (isLoggedIn && accountUserId) {
      wx.switchTab({ url: '../home/home' });
      return;
    }
    this.setData({
      done: true
    });
  }
});