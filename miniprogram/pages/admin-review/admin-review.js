Page({
  data: {
    saving: false,
    scheduleEnabled: false,
    timeValue: '21:00',
    lastMessage: ''
  },

  onLoad() {
    this.loadSchedule();
  },

  onEnableChange(e) {
    this.setData({ scheduleEnabled: !!e.detail.value });
  },

  onTimeChange(e) {
    this.setData({ timeValue: e.detail.value || '21:00' });
  },

  async loadSchedule() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'random_match_partners',
        data: { action: 'getSchedule' }
      });

      const result = res && res.result ? res.result : {};
      if (!result.success) {
        this.setData({ lastMessage: result.message || '读取计划失败' });
        return;
      }
      const data = result.data || {};
      const hh = String(data.hour || 0).padStart(2, '0');
      const mm = String(data.minute || 0).padStart(2, '0');
      this.setData({
        scheduleEnabled: !!data.enabled,
        timeValue: `${hh}:${mm}`,
        lastMessage: '已加载当前计划'
      });
    } catch (e) {
      this.setData({ lastMessage: e.message || '读取计划失败' });
    }
  },

  async saveSchedule() {
    if (this.data.saving) return;
    this.setData({ saving: true });

    const parts = (this.data.timeValue || '21:00').split(':');
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);

    try {
      const res = await wx.cloud.callFunction({
        name: 'random_match_partners',
        data: {
          action: 'setSchedule',
          enabled: this.data.scheduleEnabled,
          hour,
          minute,
          timezone: 'Asia/Shanghai'
        }
      });

      const result = res && res.result ? res.result : {};
      const detailMessage = result.message || result.error || (result.success ? '保存成功' : '保存失败');
      this.setData({ lastMessage: detailMessage });
      wx.showToast({
        title: result.success ? '已保存' : detailMessage,
        icon: 'none'
      });
    } catch (e) {
      const errText = (e && (e.errMsg || e.message)) ? (e.errMsg || e.message) : '保存失败';
      this.setData({ lastMessage: errText });
      wx.showToast({ title: '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  }
});
