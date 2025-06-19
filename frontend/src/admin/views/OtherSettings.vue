<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">其他设置</h2>
      <a-space>
        <a-button type="primary" @click="saveSettings" :loading="isLoading">
          <template #icon><icon-save /></template> 保存配置
        </a-button>
      </a-space>
    </div>

    <a-card class="settings-content-card">
    <a-form :model="formState" layout="vertical">
      <a-row :gutter="24">
        <a-col :xs="24" :sm="24" :md="12" :lg="8">
          <a-card title="用户端 Cookie 设置" :bordered="true" class="settings-card-item">
            <a-form-item field="userCookieExpire.value" label="cookie 时效" :rules="[{required: true, message: '请输入时效值'}]">
              <a-input-group compact style="width: 100%;">
                <a-input-number v-model="formState.userCookieExpire.value" :min="1"/>
                <a-select v-model="formState.userCookieExpire.unit" style="width: 80px;">
                  <a-option value="h">小时</a-option>
                  <a-option value="d">天</a-option>
                </a-select>
              </a-input-group>
              <template #help>
                <div class="text-xs text-gray-400 mt-1">
                  小时：登录后X小时到期。<br />
                  天：登录当天为第1天，至第X天23:59:59到期。
                </div>
              </template>
            </a-form-item>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="24" :md="12" :lg="8">
          <a-card title="管理端 Cookie 设置" :bordered="true" class="settings-card-item">
            <a-form-item field="adminCookieExpire.value" label="cookie 时效" :rules="[{required: true, message: '请输入时效值'}]">
              <a-input-group compact style="width: 100%;">
                <a-input-number v-model="formState.adminCookieExpire.value" :min="1" />
                <a-select v-model="formState.adminCookieExpire.unit" style="width: 80px;">
                  <a-option value="h">小时</a-option>
                  <a-option value="d">天</a-option>
                </a-select>
              </a-input-group>
              <template #help>
                <div class="text-xs text-gray-400 mt-1">
                  小时：登录后X小时到期。<br />
                  天：登录当天为第1天，至第X天23:59:59到期。
                </div>
              </template>
            </a-form-item>
          </a-card>
        </a-col>
        <a-col :xs="24" :sm="24" :md="12" :lg="8">
          <a-card title="邮箱服务设置 (SMTP)" :bordered="true" class="settings-card-item">
            <a-form-item field="emailSettings.host" label="SMTP 服务器地址" :rules="[{required: true, message: '请输入服务器地址'}]">
              <a-input v-model="formState.emailSettings.host" placeholder="例如: smtp.example.com" />
            </a-form-item>
            <a-form-item field="emailSettings.port" label="端口" :rules="[{required: true, type: 'number', message: '请输入端口号'}]">
              <a-input-number v-model="formState.emailSettings.port" placeholder="例如: 465" />
            </a-form-item>
             <a-form-item field="emailSettings.secure" label="启用 SSL/TLS">
                <a-switch v-model="formState.emailSettings.secure" />
            </a-form-item>
            <a-form-item field="emailSettings.auth.user" label="邮箱账号" :rules="[{required: true, message: '请输入邮箱账号'}]">
              <a-input v-model="formState.emailSettings.auth.user" placeholder="例如: user@example.com" />
            </a-form-item>
            <a-form-item field="emailSettings.auth.pass" label="邮箱密码/授权码" :rules="[{required: true, message: '请输入密码或授权码'}]">
              <a-input-password v-model="formState.emailSettings.auth.pass" />
            </a-form-item>
          </a-card>
        </a-col>
      </a-row>
      <a-form-item>
        <a-button type="primary" @click="saveSettings" :loading="isLoading">
          <template #icon><icon-save /></template> 保存配置
        </a-button>
      </a-form-item>
    </a-form>
  </a-card>
  </div>
</template>
<script setup>
import { ref, reactive, onMounted } from 'vue';
import { IconSave } from '@arco-design/web-vue/es/icon';
import { Message, Modal } from '@arco-design/web-vue';

const isLoading = ref(false);

// formState will be bound to the a-form model
const formState = reactive({
  userCookieExpire: { value: 7, unit: 'd' }, 
  adminCookieExpire: { value: 1, unit: 'd' },
  emailSettings: { host: '', port: 465, secure: true, auth: { user: '', pass: '' } },
});

const loadSettings = async () => {
  isLoading.value = true;
  try {
    const cookieResponse = await fetch('/api/settings/cookie', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
    });
    if (!cookieResponse.ok) {
      let errorData = { message: '加载Cookie设置失败' };
      try {
        errorData = await cookieResponse.json();
      } catch (e) { /* Ignore */ }
      throw new Error(errorData.message || `HTTP error! status: ${cookieResponse.status}`);
    }
    const cookieData = await cookieResponse.json();
    if (cookieData.userCookieExpire) {
      formState.userCookieExpire = { ...cookieData.userCookieExpire };
    }
    if (cookieData.adminCookieExpire) {
      formState.adminCookieExpire = { ...cookieData.adminCookieExpire };
    }

    const emailResponse = await fetch('/api/settings/email', {
       method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
    });
    if (!emailResponse.ok) {
      let errorData = { message: '加载邮箱设置失败' };
      try {
        errorData = await emailResponse.json();
      } catch (e) { /* Ignore */ }
      throw new Error(errorData.message || `HTTP error! status: ${emailResponse.status}`);
    }
    const emailData = await emailResponse.json();
    if (emailData) {
        formState.emailSettings = { ...emailData };
    }

  } catch (error) {
    Message.error(error.message || '加载设置失败');
    console.error('Failed to load settings:', error);
  } finally {
    isLoading.value = false;
  }
};

const saveSettings = async () => {
  // Simple validation example, Arco Form has more advanced validation 
  if (formState.userCookieExpire.value === null || formState.adminCookieExpire.value === null) {
      Message.error('时效值不能为空');
      return;
  }

  isLoading.value = true;
  try {
    // Save cookie settings
    const cookiePromise = fetch('/api/settings/cookie', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: JSON.stringify({
        userCookieExpire: formState.userCookieExpire,
        adminCookieExpire: formState.adminCookieExpire,
      }),
    });

    // Save email settings
    const emailPromise = fetch('/api/settings/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
      },
      body: JSON.stringify(formState.emailSettings),
    });

    const [cookieResponse, emailResponse] = await Promise.all([cookiePromise, emailPromise]);

    if (!cookieResponse.ok || !emailResponse.ok) {
        let errorMessages = [];
        if(!cookieResponse.ok) errorMessages.push('保存Cookie设置失败');
        if(!emailResponse.ok) errorMessages.push('保存邮箱设置失败');
        throw new Error(errorMessages.join(', '));
    }

    Message.success('设置已成功保存！');
  } catch (error) {
    Message.error(error.message || '保存设置失败');
    console.error('Failed to save settings:', error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadSettings();
});

</script>
<style scoped>
.page-container {
  /* Add padding or other styles if needed for the overall page */
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
</style>