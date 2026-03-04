// 这个页面时首页页面，显示所有已经登录的用户
const db = wx.cloud.database();
const i18n = require("../../utils/i18n");
const userFlow = require("../../utils/userFlow");
console.log("i18n:", i18n);
const app = getApp();

function isCloudFileId(path) {
  return typeof path === 'string' && path.startsWith('cloud://');
}

function getTempFileUrlMap(fileIds = []) {
  const uniqueFileIds = [...new Set(fileIds.filter((fileId) => isCloudFileId(fileId)))];
  if (!uniqueFileIds.length) {
    return Promise.resolve({});
  }

  return new Promise((resolve) => {
    wx.cloud.getTempFileURL({
      fileList: uniqueFileIds,
      success: (res) => {
        const urlMap = {};
        (res.fileList || []).forEach((item) => {
          if (item && item.fileID && item.tempFileURL) {
            urlMap[item.fileID] = item.tempFileURL;
          }
        });
        resolve(urlMap);
      },
      fail: () => resolve({})
    });
  });
}

Page({
  data: {
    language: "zh",
    text: {},
    done: false,
    dataobj: [],
    dataobjWithPartner: [],
    dataobjWithoutPartner: [],
    boysWithout: [],
    boysWith: [],
    girlsWithout: [],
    girlsWith: [],
    tabs: [
      { id: 0, name: "All", isActive: true },
      { id: 1, name: "Boys", isActive: false },
      { id: 2, name: "Girls", isActive: false },
      { id: 3, name: "Refresh", isActive: false }
    ],
    spinnerGifUrl: '/icons/spinner.gif',
    backgroundImageUrl: '/icons/background.jpg',
    cornerImageUrl: '/icons/refresh.png'
  },
  
  setLanguage() {
    console.log(app.globalData.language)
    const lang = app.globalData.language; // 
    console.log("当前语言:", lang);
    console.log("语言数据:", i18n[lang]); // 检查是否获取到文本
    this.setData({
      language: lang,
      text: i18n["en"] // 读取对应语言的文本
    });
  },
  // 切换栏目
  handleItemChange(e) {
    console.log(e);
    let tabs2 = this.data.tabs;
    let index = e.detail;
    let i = 0;
    if (index != 3) {
      for (i = 0; i < tabs2.length; i++) {
        if (i != index) { tabs2[i].isActive = false; }
        else { tabs2[i].isActive = true; }
      }
    }
    else if (index == 3) {
      var dataobj2 = this.data.dataobj;
      for (let i = dataobj2.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [dataobj2[i], dataobj2[j]] = [dataobj2[j], dataobj2[i]]; // 交换元素
      }
      this.setData({
        dataobj: dataobj2
      })
      this.classify(dataobj2)
    }
    this.setData({
      tabs: tabs2
    })
  },

  // 获得所有已登录用户的数据
  getData() {
    wx.cloud.callFunction({
      name: 'find_data_active_user',
    })
      .then(async (res) => {
        // console.log("SIGN home.js 70");
        // console.log(res);
        // console.log("SIGN home.js 72"); 
        // // console.log(res.result);
        // // console.log(res.result.data);
        const originalData = (res && res.result && res.result.data) ? res.result.data : [];
        const imageFileIds = originalData.map((userInfo) => userInfo.image).filter((image) => isCloudFileId(image));
        const imageUrlMap = await getTempFileUrlMap(imageFileIds);
        const normalizedData = originalData.map((userInfo) => ({
          ...userInfo,
          image: isCloudFileId(userInfo.image)
            ? (imageUrlMap[userInfo.image] || '/icons/person.png')
            : (userInfo.image || '/icons/person.png')
        }));

        this.setData({
          dataobj: normalizedData,
          done: true
        });
        this.classify(normalizedData)
      })
      .catch(console.error)
  },

  // 筛选用户
  classify(dataobj) {
    const withPartner = [], withoutPartner = [];
    const boysWith = [], boysWithout = [];
    const girlsWith = [], girlsWithout = [];

    for (const user of dataobj) {
      const hasPartner = !!(user.partner && user.partner.hasPartner);
      const isBoy = user.gender === '男';
      const isGirl = user.gender === '女';

      if (hasPartner) {
        withPartner.push(user);
        if (isBoy) boysWith.push(user);
        if (isGirl) girlsWith.push(user);
      } else {
        withoutPartner.push(user);
        if (isBoy) boysWithout.push(user);
        if (isGirl) girlsWithout.push(user);
      }
    }

    this.setData({
      dataobjWithPartner: withPartner,
      dataobjWithoutPartner: withoutPartner,
      boysWith,
      boysWithout,
      girlsWith,
      girlsWithout
    });
  },
  /**
   * 生命周期函数--监听页面显示
   */
  onLoad: function () {
    console.log('🏠 首页加载，检查用户登录状态...');
    
    // 只检查用户是否登录，不强制检查资料完整度
    const openid = wx.getStorageSync('openid');
    const accountUserId = wx.getStorageSync('accountUserId');
    const isLoggedIn = wx.getStorageSync('isLoggedIn');
    
    if ((!openid && !accountUserId) || !isLoggedIn) {
      console.log('❌ 用户未登录，跳转到登录页');
      wx.redirectTo({
        url: '/pages/login/login'
      });
      return;
    }
    
    console.log('✅ 用户已登录，正常加载首页');
    
    // 检查是否首次访问，给出友好提醒
    const hasShownProfileTip = wx.getStorageSync('hasShownProfileTip');
    if (!hasShownProfileTip) {
      wx.showModal({
        title: '欢迎使用！',
        content: '您可以在"我的"页面完善个人资料，让其他用户更好地了解您哦～',
        showCancel: true,
        cancelText: '稍后再说',
        confirmText: '去完善',
        success: (res) => {
          // 标记已提醒过，避免重复提醒
          wx.setStorageSync('hasShownProfileTip', true);
          
          if (res.confirm) {
            // 用户选择去完善资料
            wx.switchTab({
              url: '/pages/mine/mine'
            });
          }
          // 如果用户选择"稍后再说"，就继续正常加载首页
        }
      });
    }
    
    this.setLanguage();
    this.setData({
      done: false
    });
    this.getData();
  }
})