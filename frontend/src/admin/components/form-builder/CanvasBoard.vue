<template>
  <div class="canvas-board-wrapper">
    <div class="canvas-trigger" @click="onTriggerClick">
      <div class="canvas-placeholder">
        <span class="plus">+</span>
        <div class="placeholder-text">{{ placeholder }}</div>
      </div>
      <div v-if="imageUrl" class="canvas-thumb">
        <img :src="imageUrl" alt="画板图片" />
        <span class="canvas-thumb-close" @click.stop="removeImage">
          <icon-close />
        </span>
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
            <span>宽度：{{ displayWidth }} px</span>
            <span style="margin-left:16px;">高度：{{ displayHeight }} px</span>
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
            <a-radio value="pen">画笔</a-radio>
            <a-radio value="eraser">橡皮</a-radio>
          </a-radio-group>
          <template v-if="tool==='pen'">
            <span style="margin-left:12px;">颜色：</span>
            <input type="color" v-model="penColor" :disabled="isMask" style="vertical-align:middle;" />
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
import { ref, watch, onMounted, nextTick, computed } from 'vue';
import { Message } from '@arco-design/web-vue';
import { IconClose, IconLink, IconUnlock } from '@arco-design/web-vue/es/icon';

const props = defineProps({
  modelValue: String, // base64 或 url
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
const lineWidth = ref(6);
const drawing = ref(false);
const lastPoint = ref(null);
const canUndo = ref(false);
const canRedo = ref(false);
const undoStack = ref([]);
const redoStack = ref([]);
const imageUrl = ref(props.modelValue || props.defaultValue || '');
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
  imageUrl.value = val || '';
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
function onOk() {
  // 蒙版类型：返回原图和蒙版图
  if (props.isMask) {
    const maskData = getMaskImage();
    emit('update:modelValue', JSON.stringify({ original: imageUrl.value, mask: maskData }));
  } else {
    const data = canvasRef.value.toDataURL('image/png');
    emit('update:modelValue', data);
    imageUrl.value = data;
  }
  modalVisible.value = false;
  unbindCanvasEvents();
}

function setupCanvas() {
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  // 清空
  ctx.clearRect(0, 0, displayWidth.value, displayHeight.value);
  if (props.isMask && imageUrl.value) {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.drawImage(img, 0, 0, displayWidth.value, displayHeight.value);
      ctx.save();
      ctx.globalAlpha = props.maskOpacity;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, displayWidth.value, displayHeight.value);
      ctx.restore();
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
  // 蒙版类型：只导出黑色透明层（与原图同尺寸，透明部分为未绘制区域）
  const canvas = document.createElement('canvas');
  canvas.width = displayWidth.value;
  canvas.height = displayHeight.value;
  const ctx = canvas.getContext('2d');
  // 先填充透明
  ctx.clearRect(0, 0, displayWidth.value, displayHeight.value);
  // 取主画布内容
  const mainCtx = canvasRef.value.getContext('2d');
  const imgData = mainCtx.getImageData(0, 0, displayWidth.value, displayHeight.value);
  // 只保留黑色蒙版和用户绘制内容
  ctx.putImageData(imgData, 0, 0);
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
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lineWidth.value;
  if (tool.value === 'pen') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = props.isMask ? 'rgba(0,0,0,1)' : penColor.value;
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

function onTriggerClick() {
  if (props.isMask && !imageUrl.value) {
    fileInputRef.value && fileInputRef.value.click();
  } else {
    openModal();
  }
}

async function onFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    Message.error('只能上传图片文件');
    e.target.value = '';
    return;
  }
  // 上传
  const formData = new FormData();
  formData.append('file', file);
  try {
    const resp = await fetch(props.action, {
      method: 'POST',
      body: formData,
    });
    const data = await resp.json();
    const url = data?.url || data?.fileUrl || data?.fileName;
    if (url) {
      imageUrl.value = url;
      emit('upload-success', url);
      Message.success('图片上传成功');
      nextTick(() => {
        openModal();
      });
    } else {
      Message.error('上传响应异常');
    }
  } catch (err) {
    Message.error('图片上传失败');
  } finally {
    e.target.value = '';
  }
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
