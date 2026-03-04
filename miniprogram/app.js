// app.js
var openid
App({
  globalData: {
    language: "zh", // 默认语言
  },
  onLaunch: function () {
    
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        env: 'cloud1-1gfcqh4gb2738619',
        traceUser: true,
      });

      
      
      
      // set openid globally
      wx.cloud.callFunction({
        name: 'get_openid', success: res => {
          console.log(res.result)
          this.globalData.openid = res.result.openId
          wx.setStorageSync('wxOpenid', res.result.openId);
          
        }
        
      });
      
    }
    try {
      const systemSetting = wx.getSystemSetting();
      const language = (systemSetting && systemSetting.language) ? systemSetting.language : '';
      const lang = (typeof language === 'string' && language.startsWith("zh")) ? "zh" : "en";
      console.log(lang)
      this.globalData.language = lang;
      console.log(this.globalData)
    } catch (error) {
      console.warn('获取系统信息失败，使用默认语言zh', error);
      this.globalData.language = 'zh';
    }
  },
});
