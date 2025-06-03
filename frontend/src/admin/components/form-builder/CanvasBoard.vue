<template>
  <div class="canvas-board-wrapper">
    <div class="canvas-trigger" @click="onTriggerClick">
      <div class="canvas-placeholder">
        <span class="plus">+</span>
        <div class="placeholder-text">{{ placeholder }}</div>
      </div>
      <div v-if="imageUrl" class="canvas-thumb">
        <img :src="displayImageUrl" alt="画板图片" @click="onThumbImageClick" />
        <span class="canvas-thumb-close" @click.stop="removeImage">
          <icon-close />
        </span>
        <!-- 蒙版类型时显示蒙版按钮 -->
        <div v-if="isMask" class="canvas-mask-button" @click.stop="openModal">
          蒙版
        </div>
      </div>
      <!-- 隐藏的文件选择input -->
      <input ref="fileInputRef" type="file" accept="image/*" style="display:none" @change="onFileChange" />
    </div>
    <!-- 画板弹窗 -->
    <a-modal v-model:visible="modalVisible" width="auto" :footer="false" :closable="true" @close="onCancel">
      <template #title>画板</template>
      <div class="canvas-modal-content">
        <div class="canvas-size-bar">
          <template v-if="!isMask">
            <span>宽度：</span>
            <a-input-number v-model="editWidth" :min="10" :max="maxWidth" @change="onEditWidth" style="width:90px;" />
            <span class="canvas-aspect-lock" @click="toggleAspectLock">
              <icon-lock v-if="aspectLocked" />
              <icon-unlock v-else />
            </span>
            <a-input-number v-model="editHeight" :min="10" :max="maxHeight" @change="onEditHeight" style="width:90px;" />
          </template>
          <template v-else>
            <!-- <span>宽度：{{ displayWidth }} px</span>
            <span style="margin-left:16px;">高度：{{ displayHeight }} px</span> -->
            <span style="margin-left:24px;">蒙版透明度：</span>
            <a-slider v-model="currentMaskOpacity" :min="0" :max="1" :step="0.01" style="width:120px;display:inline-block;margin:0 8px;" @change="onMaskOpacityChange" />
            <span style="width: 50px;">{{ Math.round(currentMaskOpacity * 100) }}%</span>
          </template>
          <div class="canvas-zoom-bar">
            <span>缩放：</span>
            <a-slider v-model="scale" :min="10" :max="200" :step="1" style="width:100px;display:inline-block;" />
            <span style="margin: 0 12px;width: 30px;">{{ scale }}%</span>
            <a-button type="primary" size="mini" @click="onResetZoom">复位</a-button>
          </div>
        </div>
        <div class="canvas-toolbar">
          <a-radio-group v-model="tool">
            <a-radio value="pen">{{ isMask ? '擦除' : '画笔' }}</a-radio>
            <a-radio value="eraser">{{ isMask ? '恢复' : '橡皮' }}</a-radio>
          </a-radio-group>
          <template v-if="tool==='pen' && !isMask">
            <span style="margin-left:12px;">颜色：</span>
            <input type="color" v-model="penColor" style="vertical-align:middle;" />
          </template>
          <template v-if="isMask">
            <span style="margin-left:12px;color:#666;font-size:12px;">
              {{ tool === 'pen' ? '擦除黑色蒙版区域' : '恢复黑色蒙版区域' }}
            </span>
          </template>
          <span style="margin-left:12px;">粗细：</span>
          <a-slider v-model="lineWidth" :min="2" :max="32" :step="1" style="width:100px;display:inline-block;" />
          <a-button size="mini" @click="undo" :disabled="!canUndo" style="margin-left:16px;">撤销</a-button>
          <a-button size="mini" @click="redo" :disabled="!canRedo" style="margin-left:4px;">恢复</a-button>
          <a-button size="mini" @click="resetCanvas" style="margin-left:4px;">重置</a-button>
        </div>
        <div class="canvas-container-outer" :style="{maxWidth: maxWidth+'px', maxHeight: maxHeight+'px', overflow:'auto'}">
          <div class="canvas-container" :style="{width:displayWidth+'px',height:displayHeight+'px',transform:`scale(${scale/100})`,transformOrigin:'top left'}">
            <canvas
              ref="canvasRef"
              :width="displayWidth"
              :height="displayHeight"
              class="main-canvas"
              @mouseenter="onCanvasEnter"
              @mousemove="onCanvasMove"
              @mouseleave="onCanvasLeave"
              canvas-id="mainCanvasBoard"
            />
            <div v-if="cursorPreview.visible" class="canvas-cursor-preview" :style="cursorPreviewStyle"></div>
            <!-- 蒙版类型时，canvas下方显示原图+黑色透明层 -->
            <img v-if="isMask && imageUrl" :src="imageUrl" class="canvas-bg" :style="{width:displayWidth+'px',height:displayHeight+'px'}" @load="onImageLoad" />
          </div>
        </div>
        <div class="canvas-modal-footer">
          <a-button @click="onCancel">取消</a-button>
          <a-button type="primary" @click="onOk">确定</a-button>
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, nextTick, computed, inject } from 'vue';
import { Message, Modal } from '@arco-design/web-vue';
import { IconClose, IconLock, IconUnlock } from '@arco-design/web-vue/es/icon';

const props = defineProps({
  modelValue: String, // base64, url, or JSON string for mask {original, mask}
  action: String, // 上传接口
  placeholder: { type: String, default: '点击编辑画板' },
  isMask: { type: Boolean, default: false },
  maskOpacity: { type: Number, default: 0.1 },
  defaultValue: String,
  width: { type: Number, default: 640 },
  height: { type: Number, default: 400 },
  maxWidth: { type: Number, default: 2048 },
  maxHeight: { type: Number, default: 2048 },
});
const emit = defineEmits(['update:modelValue', 'upload-success']);

const modalVisible = ref(false);
const canvasRef = ref(null);
const tool = ref('pen'); // pen/eraser
const penColor = ref('#1677ff');
const lineWidth = ref(15);
const drawing = ref(false);
const lastPoint = ref(null);
const canUndo = ref(false);
const canRedo = ref(false);
const undoStack = ref([]);
const redoStack = ref([]);
const imageUrl = ref(initImageUrl());
const maskImageData = ref(null); // 蒙版类型时，保存蒙版图
const initialImageData = ref(null); // 打开弹窗时的画布快照
const scale = ref(100);
const editWidth = ref(props.width);
const editHeight = ref(props.height);
const displayWidth = ref(editWidth.value);
const displayHeight = ref(editHeight.value);
const maxWidth = props.maxWidth;
const maxHeight = props.maxHeight;
const aspectLocked = ref(true);
const aspectRatio = ref(editWidth.value / editHeight.value);
const fileInputRef = ref(null);
const cursorPreview = ref({
  visible: false,
  x: 0,
  y: 0,
});
const originalMaskData = ref(null); // 保存初始蒙版状态
const currentMaskOpacity = ref(props.maskOpacity);
const savedMaskState = ref(null); // 保存用户编辑后的蒙版状态
const maskPreviewUrl = ref(''); // 蒙版预览图URL
const trulyOriginalMaskData = ref(null); // 保存真正的初始蒙版状态（完整黑色蒙版）

const cursorPreviewStyle = computed(() => {
  const size = lineWidth.value;
  const left = cursorPreview.value.x - size / 2;
  const top = cursorPreview.value.y - size / 2;
  let style = {
    position: 'absolute',
    pointerEvents: 'none',
    left: left + 'px',
    top: top + 'px',
    width: size + 'px',
    height: size + 'px',
    borderRadius: '50%',
    zIndex: 10,
    boxSizing: 'border-box',
  };
  if (tool.value === 'pen') {
    style.background = hexToRgba(penColor.value, 0.7);
    style.border = '1.5px solid ' + hexToRgba(penColor.value, 1);
  } else {
    style.background = 'rgba(255,255,255,0.1)';
    style.border = '1.5px solid rgba(0,0,0,0.3)';
  }
  return style;
});

function hexToRgba(hex, alpha) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${alpha})`;
}

function removeImage() {
  imageUrl.value = '';
  emit('update:modelValue', '');
}

watch(() => props.modelValue, (val) => {
  if (val) {
    // 检查是否是蒙版数据JSON
    if (typeof val === 'string' && val.startsWith('{')) {
      try {
        const maskData = JSON.parse(val);
        if (maskData.type === 'mask_data' && maskData.original) {
          imageUrl.value = maskData.original;
          return;
        }
      } catch (e) {
        // 如果解析失败，当作普通图片URL处理
      }
    }
    imageUrl.value = val;
  } else {
    imageUrl.value = '';
  }
});

// 监听imageUrl变化，重新生成蒙版预览图
watch(() => imageUrl.value, (newUrl, oldUrl) => {
  if (props.isMask && newUrl && newUrl !== oldUrl) {
    // 如果是新的图片URL，清除预览图并重新生成
    maskPreviewUrl.value = '';
    setTimeout(() => generateMaskPreview(), 100);
  }
});

watch([editWidth, editHeight], ([w, h], [ow, oh]) => {
  if (aspectLocked.value && (w !== ow || h !== oh)) {
    aspectRatio.value = w / h;
  }
  if (!props.isMask) {
    // 1. 保存当前内容为图片
    const canvas = canvasRef.value;
    const oldDataUrl = canvas.toDataURL('image/png');
    // 2. 更新显示宽高
    displayWidth.value = w;
    displayHeight.value = h;
    // 3. 等待 DOM 更新后还原内容
    nextTick(() => {
      setupCanvas();
      // 4. 绘制旧内容到新尺寸
      const ctx = canvasRef.value.getContext('2d');
      const img = new window.Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, ow, oh, 0, 0, w, h);
        saveState();
      };
      img.src = oldDataUrl;
    });
  }
});

function toggleAspectLock() {
  aspectLocked.value = !aspectLocked.value;
  if (aspectLocked.value) {
    aspectRatio.value = editWidth.value / editHeight.value;
  }
}
function onEditWidth(val) {
  if (aspectLocked.value) {
    editHeight.value = Math.round(val / aspectRatio.value);
  }
}
function onEditHeight(val) {
  if (aspectLocked.value) {
    editWidth.value = Math.round(val * aspectRatio.value);
  }
}

function onImageLoad(e) {
  if (props.isMask) {
    const img = e.target;
    let w = img.naturalWidth, h = img.naturalHeight;
    const ratio = Math.min(1000 / w, 650 / h, 1);
    displayWidth.value = Math.round(w * ratio);
    displayHeight.value = Math.round(h * ratio);
    setupCanvas();
    // 生成初始预览图
    setTimeout(() => generateMaskPreview(), 100);
  }
}

function openModal() {
  modalVisible.value = true;
  nextTick(() => {
    setupCanvas();
    saveInitialState();
    bindCanvasEvents();
  });
}
function onCancel() {
  modalVisible.value = false;
  restoreInitialState();
  unbindCanvasEvents();
}
async function onOk() {
  try {
    if (props.isMask) {
      // 保存当前蒙版编辑状态
      const ctx = canvasRef.value.getContext('2d');
      savedMaskState.value = ctx.getImageData(0, 0, displayWidth.value, displayHeight.value);
      
      const maskBase64 = getMaskImage();
      // 蒙版模式下直接emit数据，不更新imageUrl
      emit('update:modelValue', JSON.stringify({ original: imageUrl.value, mask: maskBase64, type: 'mask_data' }));
      
      // 生成预览图
      generateMaskPreview();
      
      Message.success('蒙版数据已准备好');
    } else {
      const imageBase64 = canvasRef.value.toDataURL('image/png');
      // 普通模式下更新imageUrl为画布内容
      imageUrl.value = imageBase64;
      emit('update:modelValue', imageBase64);
      Message.success('画板数据已准备好');
    }
    modalVisible.value = false;
    unbindCanvasEvents();
  } catch (error) {
    Message.error('准备数据失败: ' + error.message);
    console.error('Error in onOk preparing data:', error);
  }
}

function setupCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // 清空
  ctx.clearRect(0, 0, displayWidth.value, displayHeight.value);
  if (props.isMask && imageUrl.value) {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, displayWidth.value, displayHeight.value);
      
      // 先生成并保存真正的初始蒙版状态（完整黑色蒙版）
      ctx.save();
      ctx.globalAlpha = currentMaskOpacity.value;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, displayWidth.value, displayHeight.value);
      ctx.restore();
      
      // 保存真正的初始状态（用于恢复工具恢复到完整蒙版）
      trulyOriginalMaskData.value = ctx.getImageData(0, 0, displayWidth.value, displayHeight.value);
      
      // 如果有保存的蒙版编辑状态，恢复它
      if (savedMaskState.value) {
        ctx.putImageData(savedMaskState.value, 0, 0);
      }
      
      // originalMaskData用于getMaskImage函数的对比
      originalMaskData.value = trulyOriginalMaskData.value;
      
      saveState();
    };
    img.src = imageUrl.value;
  } else if (!props.isMask && imageUrl.value) {
    // 非mask类型，回显已保存的画布内容
    const img = new window.Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, displayWidth.value, displayHeight.value);
      saveState();
    };
    img.src = imageUrl.value;
  } else {
    saveState();
  }
}

function saveState() {
  const canvas = canvasRef.value;
  undoStack.value.push(canvas.getContext('2d').getImageData(0, 0, displayWidth.value, displayHeight.value));
  redoStack.value = [];
  updateUndoRedo();
}
function undo() {
  if (undoStack.value.length > 1) {
    redoStack.value.push(undoStack.value.pop());
    const ctx = canvasRef.value.getContext('2d');
    ctx.putImageData(undoStack.value[undoStack.value.length - 1], 0, 0);
    updateUndoRedo();
  }
}
function redo() {
  if (redoStack.value.length > 0) {
    const ctx = canvasRef.value.getContext('2d');
    const data = redoStack.value.pop();
    undoStack.value.push(data);
    ctx.putImageData(data, 0, 0);
    updateUndoRedo();
  }
}
function resetCanvas() {
  setupCanvas();
}
function updateUndoRedo() {
  canUndo.value = undoStack.value.length > 1;
  canRedo.value = redoStack.value.length > 0;
}

function saveInitialState() {
  // 打开弹窗时保存初始状态
  const ctx = canvasRef.value.getContext('2d');
  initialImageData.value = ctx.getImageData(0, 0, displayWidth.value, displayHeight.value);
}
function restoreInitialState() {
  // 取消时还原
  if (initialImageData.value) {
    const ctx = canvasRef.value.getContext('2d');
    ctx.putImageData(initialImageData.value, 0, 0);
  }
}

function getMaskImage() {
  // 蒙版类型：只导出蒙版数据（黑色=蒙版区域，透明=非蒙版区域）
  const canvas = document.createElement('canvas');
  canvas.width = displayWidth.value;
  canvas.height = displayHeight.value;
  const ctx = canvas.getContext('2d');
  
  // 先填充黑色作为默认蒙版
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, displayWidth.value, displayHeight.value);
  
  // 取主画布内容
  const mainCtx = canvasRef.value.getContext('2d');
  const mainImageData = mainCtx.getImageData(0, 0, displayWidth.value, displayHeight.value);
  const maskImageData = ctx.getImageData(0, 0, displayWidth.value, displayHeight.value);
  
  // 对比初始蒙版状态，找出用户擦除的区域
  if (originalMaskData.value) {
    for (let i = 0; i < mainImageData.data.length; i += 4) {
      // 如果当前像素的透明度小于初始状态，说明被用户擦除了
      if (mainImageData.data[i + 3] < originalMaskData.value.data[i + 3]) {
        // 在蒙版中设为透明（非蒙版区域）
        maskImageData.data[i + 3] = 0; // 设置alpha为0，透明
      }
      // 其他情况保持黑色（蒙版区域）
    }
  }
  
  ctx.putImageData(maskImageData, 0, 0);
  return canvas.toDataURL('image/png');
}

// 画笔/橡皮逻辑
function onPointerDown(e) {
  drawing.value = true;
  lastPoint.value = getCanvasPos(e);
}
function onPointerMove(e) {
  if (!drawing.value) return;
  const ctx = canvasRef.value.getContext('2d');
  
  if (props.isMask) {
    // 蒙版模式下的逻辑
    if (tool.value === 'pen') {
      // 擦除黑色蒙版层
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = lineWidth.value;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      ctx.moveTo(lastPoint.value.x, lastPoint.value.y);
      const newPoint = getCanvasPos(e);
      ctx.lineTo(newPoint.x, newPoint.y);
      ctx.stroke();
      ctx.restore();
      lastPoint.value = newPoint;
    } else {
      // 恢复工具：从真正的初始蒙版数据中恢复
      if (trulyOriginalMaskData.value) {
        const newPoint = getCanvasPos(e);
        
        // 创建临时画布来绘制路径蒙版
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = displayWidth.value;
        tempCanvas.height = displayHeight.value;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 在临时画布上绘制路径
        tempCtx.lineCap = 'round';
        tempCtx.lineJoin = 'round';
        tempCtx.lineWidth = lineWidth.value;
        tempCtx.strokeStyle = 'white';
        tempCtx.beginPath();
        tempCtx.moveTo(lastPoint.value.x, lastPoint.value.y);
        tempCtx.lineTo(newPoint.x, newPoint.y);
        tempCtx.stroke();
        
        // 获取临时画布的图像数据作为蒙版
        const tempImageData = tempCtx.getImageData(0, 0, displayWidth.value, displayHeight.value);
        const currentImageData = ctx.getImageData(0, 0, displayWidth.value, displayHeight.value);
        
        // 按照蒙版从真正的初始状态恢复像素
        for (let i = 0; i < tempImageData.data.length; i += 4) {
          if (tempImageData.data[i] > 0) { // 如果蒙版位置有像素
            // 从真正的初始数据恢复这个像素
            currentImageData.data[i] = trulyOriginalMaskData.value.data[i];
            currentImageData.data[i + 1] = trulyOriginalMaskData.value.data[i + 1];
            currentImageData.data[i + 2] = trulyOriginalMaskData.value.data[i + 2];
            currentImageData.data[i + 3] = trulyOriginalMaskData.value.data[i + 3];
          }
        }
        
        // 将修改后的数据放回画布
        ctx.putImageData(currentImageData, 0, 0);
        
        lastPoint.value = newPoint;
      }
    }
  } else {
    // 普通绘画模式
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lineWidth.value;
    if (tool.value === 'pen') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = penColor.value;
    } else {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    }
    ctx.beginPath();
    ctx.moveTo(lastPoint.value.x, lastPoint.value.y);
    const newPoint = getCanvasPos(e);
    ctx.lineTo(newPoint.x, newPoint.y);
    ctx.stroke();
    ctx.restore();
    lastPoint.value = newPoint;
  }
}
function onPointerUp() {
  if (drawing.value) {
    drawing.value = false;
    saveState();
  }
}
function getCanvasPos(e) {
  const rect = canvasRef.value.getBoundingClientRect();
  let x, y;
  if (e.touches && e.touches.length) {
    x = e.touches[0].clientX - rect.left;
    y = e.touches[0].clientY - rect.top;
  } else {
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
  }
  // 修正缩放
  const scaleRatio = scale.value / 100;
  return { x: x / scaleRatio, y: y / scaleRatio };
}

function onResetZoom() {
  scale.value = 100;
}

// 确认替换图片（蒙版模式下有编辑状态时使用）
function confirmReplaceImage() {
  // 直接打开文件选择，在onFileChange中进行确认
  fileInputRef.value && fileInputRef.value.click();
}

function onTriggerClick() {
  if (props.isMask) {
    if (!imageUrl.value) {
      // 蒙版类型且没有图片，上传图片
      fileInputRef.value && fileInputRef.value.click();
    } else {
      // 蒙版类型有图片，处理蒙版相关逻辑
      if (savedMaskState.value || trulyOriginalMaskData.value) {
        confirmReplaceImage();
      }
      // 没有编辑状态时，通过蒙版按钮来打开画板
    }
  } else {
    // 非mask类型，直接打开画板
    openModal();
  }
}

function onThumbImageClick(e) {
  e.stopPropagation();
  if (props.isMask) {
    // 蒙版类型，允许替换图片
    confirmReplaceImage();
  } else {
    // 非mask类型，直接打开画板
    openModal();
  }
}

async function onFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    Message.error('只能上传图片文件');
    if(e.target) e.target.value = '';
    return;
  }

  // 如果是蒙版模式且有编辑状态，先确认
  if (props.isMask && (savedMaskState.value || trulyOriginalMaskData.value)) {
    Modal.confirm({
      title: '确认替换图片',
      content: `您已选择文件"${file.name}"，替换图片将移除当前绘制的蒙版，是否确认替换？`,
      okText: '确认替换',
      cancelText: '取消',
      onOk: async () => {
        await processFileUpload(file);
      },
      onCancel: () => {
        // 用户取消，清空文件输入
        if(e.target) e.target.value = '';
      }
    });
  } else {
    // 直接处理文件上传
    await processFileUpload(file);
  }
}

async function processFileUpload(file) {
  try {
    const base64String = await fileToBase64(file);
    imageUrl.value = base64String;
    
    // 重新上传图片时，清除之前的蒙版编辑状态
    if (props.isMask) {
      savedMaskState.value = null;
      trulyOriginalMaskData.value = null;
      originalMaskData.value = null;
      maskPreviewUrl.value = '';
    }
    
    Message.success('图片已加载，可以开始绘制。');
    
    // 如果是蒙版模式，生成预览图
    if (props.isMask) {
      // 等待图片加载完成后生成预览图
      setTimeout(() => generateMaskPreview(), 200);
    }

  } catch (err) {
    Message.error('加载图片失败: ' + (err.message || err));
    console.error('Error in processFileUpload converting to base64:', err);
  } finally {
    // 清空文件输入，允许重复选择同一文件
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

function bindCanvasEvents() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('touchstart', onPointerDown);
  canvas.addEventListener('touchmove', onPointerMove);
  window.addEventListener('touchend', onPointerUp);
}
function unbindCanvasEvents() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.removeEventListener('mousedown', onPointerDown);
  canvas.removeEventListener('mousemove', onPointerMove);
  window.removeEventListener('mouseup', onPointerUp);
  canvas.removeEventListener('touchstart', onPointerDown);
  canvas.removeEventListener('touchmove', onPointerMove);
  window.removeEventListener('touchend', onPointerUp);
}

function onCanvasEnter(e) {
  cursorPreview.value.visible = true;
}
function onCanvasMove(e) {
  const rect = canvasRef.value.getBoundingClientRect();
  const scaleRatio = scale.value / 100;
  cursorPreview.value.x = (e.clientX - rect.left) / scaleRatio;
  cursorPreview.value.y = (e.clientY - rect.top) / scaleRatio;
}
function onCanvasLeave() {
  cursorPreview.value.visible = false;
}

function onMaskOpacityChange(value) {
  currentMaskOpacity.value = value;
  // 重新绘制蒙版以应用新的透明度
  if (props.isMask && imageUrl.value && canvasRef.value) {
    const canvas = canvasRef.value;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // 获取当前画布状态（保存用户已绘制的内容）
    const currentData = ctx.getImageData(0, 0, displayWidth.value, displayHeight.value);
    
    // 重新绘制背景图片
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // 清空画布
      ctx.clearRect(0, 0, displayWidth.value, displayHeight.value);
      // 绘制原图
      ctx.drawImage(img, 0, 0, displayWidth.value, displayHeight.value);
      // 应用新透明度的蒙版层
      ctx.save();
      ctx.globalAlpha = currentMaskOpacity.value;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, displayWidth.value, displayHeight.value);
      ctx.restore();
      
      // 更新真正的初始蒙版状态
      trulyOriginalMaskData.value = ctx.getImageData(0, 0, displayWidth.value, displayHeight.value);
      // 更新初始蒙版状态
      originalMaskData.value = trulyOriginalMaskData.value;
      
      // 恢复用户已绘制的内容（只恢复透明部分，保持用户的擦除效果）
      const newData = ctx.getImageData(0, 0, displayWidth.value, displayHeight.value);
      for (let i = 0; i < currentData.data.length; i += 4) {
        // 如果原来的位置是透明的（用户擦除过的），保持透明
        if (currentData.data[i + 3] < trulyOriginalMaskData.value.data[i + 3]) {
          newData.data[i + 3] = currentData.data[i + 3];
        }
      }
      ctx.putImageData(newData, 0, 0);
    };
    img.src = imageUrl.value;
  }
}

// 初始化imageUrl，正确处理蒙版数据
function initImageUrl() {
  const val = props.modelValue || props.defaultValue || '';
  if (val) {
    // 检查是否是蒙版数据JSON
    if (typeof val === 'string' && val.startsWith('{')) {
      try {
        const maskData = JSON.parse(val);
        if (maskData.type === 'mask_data' && maskData.original) {
          return maskData.original;
        }
      } catch (e) {
        // 如果解析失败，当作普通图片URL处理
      }
    }
    return val;
  }
  return '';
}

// 生成蒙版预览图（原图+蒙版效果）
function generateMaskPreview() {
  if (!props.isMask || !imageUrl.value) return '';
  
  const img = new window.Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    // 计算显示尺寸
    let w = img.naturalWidth, h = img.naturalHeight;
    const ratio = Math.min(1000 / w, 650 / h, 1);
    const canvasWidth = Math.round(w * ratio);
    const canvasHeight = Math.round(h * ratio);
    
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    
    // 绘制原图
    ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
    
    // 如果有保存的蒙版状态，应用它
    if (savedMaskState.value && displayWidth.value && displayHeight.value) {
      // 创建临时画布来处理保存的状态
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = displayWidth.value;
      tempCanvas.height = displayHeight.value;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(savedMaskState.value, 0, 0);
      
      // 将保存的状态缩放绘制到预览画布上
      ctx.drawImage(tempCanvas, 0, 0, canvasWidth, canvasHeight);
    } else {
      // 否则应用默认蒙版
      ctx.save();
      ctx.globalAlpha = currentMaskOpacity.value;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.restore();
    }
    
    maskPreviewUrl.value = canvas.toDataURL('image/png');
  };
  img.src = imageUrl.value;
}

// 计算显示的缩略图URL
const displayImageUrl = computed(() => {
  if (props.isMask && maskPreviewUrl.value) {
    return maskPreviewUrl.value;
  }
  return imageUrl.value;
});
</script>

<style scoped>
.canvas-board-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
}
.canvas-zoom-bar {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.canvas-size-bar {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  gap: 12px;
}
.canvas-trigger {
  cursor: pointer;
  border: 1px dashed var(--color-neutral-3);
  border-radius: 6px;
  width: 220px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-fill-2);
  position: relative;
}
.canvas-placeholder {
  text-align: center;
}
.plus {
  font-size: 32px;
  color: #bbb;
  display: block;
}
.placeholder-text {
  color: #888;
  font-size: 14px;
}
.canvas-thumb {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid #eee;
  background: repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 0 0/40px 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.canvas-thumb img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  margin: auto;
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
}
.canvas-thumb-close {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(255,255,255,0.85);
  border-radius: 50%;
  cursor: pointer;
  z-index: 2;
  padding: 2px;
  font-size: 16px;
  color: #888;
  transition: background 0.2s;
}
.canvas-thumb-close:hover {
  background: #f5222d;
  color: #fff;
}
.canvas-mask-button {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(22, 119, 255, 0.9);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  z-index: 3;
  transition: background 0.2s;
  user-select: none;
}
.canvas-mask-button:hover {
  background: rgba(22, 119, 255, 1);
}
.canvas-modal-content {
  padding: 8px 0 0 0;
}
.canvas-toolbar {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.canvas-container-outer {
  width: 100%;
  max-width: 1000px;
  max-height: 650px;
  margin: 0 auto 16px auto;
  border-radius: 6px;
  overflow: auto;
}
.canvas-container {
  position: relative;
  background: repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 0 0/40px 40px;
  border-radius: 6px;
  overflow: hidden;
}
.main-canvas {
  position: absolute;
  left: 0; top: 0;
  z-index: 2;
  background: transparent;
}
.canvas-bg {
  position: absolute;
  left: 0; top: 0;
  z-index: 0;
  pointer-events: none;
}
.canvas-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 12px;
}
.canvas-aspect-lock {
  display: inline-flex;
  align-items: center;
  margin: 0 8px;
  cursor: pointer;
  color: #888;
  font-size: 18px;
  transition: color 0.2s;
}
.canvas-aspect-lock:hover {
  color: #1677ff;
}
.canvas-cursor-preview {
  box-sizing: border-box;
  pointer-events: none;
  transition: border 0.1s, background 0.1s;
}
</style>
