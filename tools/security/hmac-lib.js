#!/usr/bin/env node
/**
 * HMAC 签名工具库
 * 供 hmac-verify.js 和 smoke_concurrency.js 复用
 */

const crypto = require('crypto');

/**
 * 生成随机 nonce
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 获取当前时间戳（秒级）
 */
function getCurrentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

/**
 * 构建签名消息（根据 hmac-signature.interceptor.ts 的实现）
 * 格式：${method}\n${requestPath}\n${timestamp}\n${nonce}\n${body}
 * 
 * @param {string} method - HTTP 方法
 * @param {string} path - 请求路径（含 /api 前缀，不含 query string）
 * @param {string} timestamp - 时间戳（秒级字符串）
 * @param {string} nonce - 随机 nonce
 * @param {string|object} body - 请求体（对象会被 JSON.stringify）
 */
function buildMessage(method, path, timestamp, nonce, body) {
  const bodyString = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
  return `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyString}`;
}

/**
 * 计算 HMAC-SHA256 签名
 * @param {string} secret - API Secret
 * @param {string} message - 签名消息
 * @returns {string} 十六进制签名
 */
function computeSignature(secret, message) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

/**
 * 生成 HMAC 认证头
 * @param {string} apiKey - API Key
 * @param {string} apiSecret - API Secret
 * @param {string} method - HTTP 方法
 * @param {string} path - 请求路径（含 /api 前缀）
 * @param {string|object} body - 请求体
 * @returns {object} 包含 X-Api-Key, X-Nonce, X-Timestamp, X-Signature 的对象
 */
function generateHmacHeaders(apiKey, apiSecret, method, path, body) {
  const timestamp = String(getCurrentTimestamp()); // 秒级时间戳
  const nonce = generateNonce();
  const message = buildMessage(method, path, timestamp, nonce, body);
  const signature = computeSignature(apiSecret, message);
  
  return {
    'X-Api-Key': apiKey,
    'X-Nonce': nonce,
    'X-Timestamp': timestamp,
    'X-Signature': signature,
  };
}

module.exports = {
  generateNonce,
  getCurrentTimestamp,
  buildMessage,
  computeSignature,
  generateHmacHeaders,
};

