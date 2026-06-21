/**
 * 轻量数据变更事件
 *
 * 用于跨组件通知数据已变更（如导入/重置/删除），
 * 触发 hooks 自动刷新，避免 window.location.reload() 导致的全页闪烁。
 */

const EVENT_NAME = 'myfundsys:data-changed';

export function dispatchDataChanged(): void {
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

export function onDataChanged(callback: () => void): () => void {
  window.addEventListener(EVENT_NAME, callback);
  return () => window.removeEventListener(EVENT_NAME, callback);
}
